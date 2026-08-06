const mongoose = require('mongoose');
const { sendOTPEmail } = require('../../utilities/email');
const { generateOTPWithExpiry, validateOTP } = require('../../utilities/otp');
const { getDocumentsInRanges } = require('./evolution_calculator');
const { logAuditEvent } = require('../../middlewares/audit');

const PROTECTED_COLLECTIONS = ['users', 'department', 'room'];
const SYSTEM_COLLECTIONS = ['system.views', 'system.buckets', 'system.profile', 'system.users', 'system.roles', 'system.version', 'system.sessions', 'system.namespaces', 'system.preimages', 'system.javascript'];

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const toUTCMidnight = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const toUTCEndOfDay = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
};

const getPeriodBounds = (period, from, to) => {
  const now = new Date();
  const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  if (period === 'today') return { start: nowUTC, end: toUTCEndOfDay(now) };
  if (period === 'week') {
    const dayOfWeek = nowUTC.getUTCDay();
    const monday = new Date(nowUTC);
    monday.setUTCDate(monday.getUTCDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  if (period === 'month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }
  if (period === 'last_month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
    return { start, end };
  }
  if (period === 'range' && from) {
    const start = toUTCMidnight(from);
    const end = to ? toUTCEndOfDay(to) : toUTCEndOfDay(now);
    return { start, end };
  }
  return null;
};

const generateTimeBuckets = (period, bounds) => {
  const buckets = [];
  if (!bounds) return buckets;

  const start = bounds.start;
  const end = bounds.end;

  if (period === 'today') {
    for (let hour = 0; hour < 24; hour++) {
      const slotStart = new Date(start);
      slotStart.setUTCHours(hour, 0, 0, 0);
      const slotEnd = new Date(start);
      slotEnd.setUTCHours(hour, 59, 59, 999);
      if (slotStart >= start && slotStart <= end) {
        buckets.push({ label: `${hour.toString().padStart(2, '0')}:00`, start: slotStart, end: slotEnd });
      }
    }
  } else if (period === 'week' || period === 'month' || period === 'last_month') {
    const current = new Date(start);
    while (current <= end) {
      const dayStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 23, 59, 59, 999));
      buckets.push({ label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), start: dayStart, end: dayEnd });
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (period === 'year') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 0, 0, 0, 0));
    while (current <= end) {
      const monthStart = new Date(current);
      const lastDayOfMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
      const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), lastDayOfMonth.getUTCDate(), 23, 59, 59, 999));
      if (monthStart < start) monthStart.setTime(start.getTime());
      if (monthEnd > end) monthEnd.setTime(end.getTime());
      buckets.push({ label: months[monthStart.getUTCMonth()], start: monthStart, end: monthEnd });
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  } else if (period === 'range') {
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) {
      for (let hour = 0; hour < 24; hour++) {
        const slotStart = new Date(start);
        slotStart.setUTCHours(hour, 0, 0, 0);
        const slotEnd = new Date(start);
        slotEnd.setUTCHours(hour, 59, 59, 999);
        if (slotStart >= start && slotStart <= end) {
          buckets.push({ label: `${hour.toString().padStart(2, '0')}:00`, start: slotStart, end: slotEnd });
        }
      }
    } else if (diffDays <= 31) {
      const current = new Date(start);
      while (current <= end) {
        const dayStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
        const dayEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 23, 59, 59, 999));
        buckets.push({ label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), start: dayStart, end: dayEnd });
        current.setUTCDate(current.getUTCDate() + 1);
      }
    } else if (diffDays <= 365) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 0, 0, 0, 0));
      while (current <= end) {
        const monthStart = new Date(current);
        const lastDayOfMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
        const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), lastDayOfMonth.getUTCDate(), 23, 59, 59, 999));
        if (monthStart < start) monthStart.setTime(start.getTime());
        if (monthEnd > end) monthEnd.setTime(end.getTime());
        buckets.push({ label: months[monthStart.getUTCMonth()], start: monthStart, end: monthEnd });
        current.setUTCMonth(current.getUTCMonth() + 1);
      }
    } else {
      const current = new Date(Date.UTC(start.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      while (current <= end) {
        const yearStart = new Date(current);
        const yearEnd = new Date(Date.UTC(current.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
        if (yearStart < start) yearStart.setTime(start.getTime());
        if (yearEnd > end) yearEnd.setTime(end.getTime());
        buckets.push({ label: String(yearStart.getUTCFullYear()), start: yearStart, end: yearEnd });
        current.setUTCFullYear(current.getUTCFullYear() + 1);
      }
    }
  }
  return buckets;
};

const COMMON_DATE_FIELDS = ['createdAt', 'created_at', 'createdDate', 'created_date', 'date', 'timestamp', 'time', 'entry_date', 'check_in', 'startedAt', 'meetingDate', 'attendanceTime', 'willStartAt', 'startedAt', 'endedAt', 'expectedToEndAt', 'willEndAt', 'reception_date', 'redaction_date', 'createdAt', 'updatedAt', 'updated_at', 'deletedAt'];

async function findModelForCollection(collectionName) {
  const modelNames = Object.keys(mongoose.models);
  for (const modelName of modelNames) {
    try {
      const model = mongoose.model(modelName);
      if (model && model.collection && model.collection.collectionName === collectionName) {
        return model;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function detectDateField(Model) {
  if (!Model) return null;
  const schema = Model.schema;
  const paths = Object.keys(schema.paths);
  
  for (const field of COMMON_DATE_FIELDS) {
    if (paths.includes(field)) {
      return field;
    }
  }
  
  for (const path of paths) {
    const schemaType = schema.paths[path];
    if (schemaType && schemaType.instance === 'Date') {
      return path;
    }
  }
  
  return null;
}

async function getCollectionInfo(collectionName) {
  try {
    const db = mongoose.connection.db;
    const stats = await db.command({ collStats: collectionName });
    
    const Model = await findModelForCollection(collectionName);
    const dateField = await detectDateField(Model);
    
    let label = collectionName;
    if (Model && Model.modelName) {
      label = Model.modelName;
    }
    
    const words = label.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    label = words.charAt(0).toUpperCase() + words.slice(1);
    
    return {
      name: label,
      collectionName,
      count: stats.count || 0,
      size: stats.size || 0,
      avgObjSize: stats.avgObjSize || (stats.count > 0 ? stats.size / stats.count : 0),
      dateField,
      modelName: Model ? Model.modelName : null,
    };
  } catch (error) {
    console.error(`[StorageStats] Error getting info for ${collectionName}:`, error.message);
    return null;
  }
}

async function getStorageStats(req, res) {
  return;
  try {
    let { period = 'month', from, to } = req.query || {};
    const bounds = getPeriodBounds(period, from, to);
    const timeBuckets = generateTimeBuckets(period, bounds);

    console.log(`[StorageStats] period=${period} bounds=${bounds ? bounds.start.toISOString() + ' to ' + bounds.end.toISOString() : 'null'}`);
    console.log(`[StorageStats] generated ${timeBuckets.length} time buckets`);

    const db = mongoose.connection.db;
    const collectionsInfo = await db.listCollections().toArray();
    
    const collections = [];
    let totalSize = 0;
    let totalCount = 0;

    for (const colInfo of collectionsInfo) {
      const collectionName = colInfo.name;
      
      if (PROTECTED_COLLECTIONS.includes(collectionName)) continue;
      if (SYSTEM_COLLECTIONS.includes(collectionName)) continue;
      if (collectionName.startsWith('system.')) continue;
      if (collectionName === 'fs.files' || collectionName === 'fs.chunks') continue;

      const info = await getCollectionInfo(collectionName);
      if (info && info.count > 0) {
        collections.push({
          name: info.name,
          collectionName,
          count: info.count,
          size: info.size,
          formattedSize: formatBytes(info.size),
          avgObjSize: info.avgObjSize,
          dateField: info.dateField,
        });
        totalSize += info.size;
        totalCount += info.count;
      }
    }

    console.log(`[StorageStats] collections with data=${collections.length}`);

    const evolutionData = [];
    if (timeBuckets.length > 0 && collections.length > 0) {
      for (const col of collections) {
        if (!col.dateField) {
          console.log(`[StorageStats] skipping ${col.name} - no dateField`);
          continue;
        }

        try {
          console.log(`[StorageStats] processing evolution for ${col.name} (${col.collectionName}) dateField=${col.dateField}`);
          
          const bucketCounts = await getDocumentsInRanges(col.collectionName, col.dateField, timeBuckets);
          const timeSeries = timeBuckets.map(bucket => ({
            name: bucket.label,
            size: bucketCounts[bucket.label]?.size || 0,
            formattedSize: bucketCounts[bucket.label]?.formattedSize || '0 B',
          }));

          evolutionData.push({
            name: col.name,
            timeSeries,
          });
          
          console.log(`[StorageStats] ${col.name}: timeSeries length=${timeSeries.length}, first=${JSON.stringify(timeSeries[0])}`);
        } catch (colError) {
          console.error(`[StorageStats] Error processing collection ${col.collectionName}:`, colError.message);
        }
      }
    }

    console.log(`[StorageStats] final evolution entries=${evolutionData.length}`);

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Storage statistics fetched successfully',
      data: {
        totalStorage: totalSize,
        totalStorageFormatted: formatBytes(totalSize),
        totalRecords: totalCount,
        collections,
        evolution: evolutionData,
        period,
        bounds: bounds ? { start: bounds.start.toISOString(), end: bounds.end.toISOString() } : null,
      },
    });
  } catch (error) {
    console.error('Error in getStorageStats:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while fetching storage statistics',
      error: error.message,
    });
  }
}

async function requestDeleteToken(req, res) {
  try {
    const { collections, period, from, to, reason } = req.body || {};
    const userId = req.user?.id || req.user?._id;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'User email is required',
      });
    }

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'At least one collection must be selected',
      });
    }

    for (const col of collections) {
      if (PROTECTED_COLLECTIONS.includes(col) || col === 'room' || col === 'audits') {
        return res.status(403).json({
          success: false,
          type: 'error',
          message: `Collection "${col}" is protected and cannot be deleted`,
        });
      }
    }

    const bounds = getPeriodBounds(period || 'month', from, to);
    const otpData = generateOTPWithExpiry();
    const deleteToken = otpData.otp;

    const deleteRequest = {
      token: deleteToken,
      collections,
      period,
      from,
      to,
      bounds,
      reason,
      userId,
      userEmail,
      createdAt: Date.now(),
      expiresAt: otpData.expiresAt,
    };

    if (!global.DELETE_REQUEST) global.DELETE_REQUEST = {};
    const requestKey = `${userEmail}:${deleteToken}`;
    global.DELETE_REQUEST[requestKey] = deleteRequest;

    setTimeout(() => {
      if (global.DELETE_REQUEST && global.DELETE_REQUEST[requestKey]) {
        delete global.DELETE_REQUEST[requestKey];
      }
    }, 300000);

    const collectionsList = collections.join(', ');

    await sendOTPEmail(userEmail, deleteToken, 'delete');

    return res.status(200).json({
      success: true,
      type: 'success',
      message: `Delete confirmation token sent to ${userEmail}. This will delete data from: ${collectionsList}`,
      data: {
        requestKey,
        expiresIn: 300,
        collections: collections.length,
      },
    });
  } catch (error) {
    console.error('Error in requestDeleteToken:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while requesting delete token',
      error: error.message,
    });
  }
}

async function confirmDelete(req, res) {
  try {
    const { requestKey, token } = req.body || {};
    const userEmail = req.user?.email;

    if (!requestKey || !token) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Delete request key and token are required',
      });
    }

    if (!global.DELETE_REQUEST || !global.DELETE_REQUEST[requestKey]) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Delete request expired or not found',
      });
    }

    const deleteRequest = global.DELETE_REQUEST[requestKey];
    if (deleteRequest.userEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        type: 'error',
        message: 'Unauthorized: email does not match',
      });
    }

    const otpValidation = validateOTP(token, deleteRequest.token, deleteRequest.expiresAt);
    if (!otpValidation.valid) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: otpValidation.error || 'Invalid or expired token',
      });
    }

    const { collections, bounds } = deleteRequest;
    const deleteResults = [];

    for (const collectionName of collections) {
      try {
        const db = mongoose.connection.db;
        const statsBefore = await db.command({ collStats: collectionName });
        const countBefore = statsBefore.count || 0;

        const collection = db.collection(collectionName);
        const query = {};
        
        const info = await getCollectionInfo(collectionName);
        if (info && info.dateField && bounds) {
          query[info.dateField] = { $gte: bounds.start, $lte: bounds.end };
        }

        const result = await collection.deleteMany(query);
        const deletedCount = result.deletedCount || 0;

        const statsAfter = await db.command({ collStats: collectionName });
        const sizeAfter = statsAfter.size || 0;
        const sizeFreed = Math.max(0, (statsBefore.size || 0) - sizeAfter);

        deleteResults.push({
          collection: info ? info.name : collectionName,
          collectionName,
          deletedCount,
          sizeFreed,
          formattedSizeFreed: formatBytes(sizeFreed),
        });
      } catch (colError) {
        console.error(`Error deleting from ${collectionName}:`, colError);
        deleteResults.push({
          collection: collectionName,
          collectionName,
          error: colError.message,
        });
      }
    }

    if (global.DELETE_REQUEST && global.DELETE_REQUEST[requestKey]) {
      delete global.DELETE_REQUEST[requestKey];
    }

    const totalDeleted = deleteResults.reduce((sum, r) => sum + (r.deletedCount || 0), 0);

    await logAuditEvent('DELETE', `Data deletion performed: ${totalDeleted} records deleted from ${deleteRequest.collections.length} collection(s)`, req, {
      resource: 'data_management',
      status_code: 200,
      metadata: {
        un_deletable: true,
        collections: deleteRequest.collections,
        period: deleteRequest.period,
        bounds: deleteRequest.bounds,
        totalDeleted,
        results: deleteResults,
        reason: deleteRequest.reason,
      }
    });

    return res.status(200).json({
      success: true,
      type: 'success',
      message: `Successfully deleted ${totalDeleted} records`,
      data: {
        results: deleteResults,
        totalDeleted,
        period: deleteRequest.period,
      },
    });
  } catch (error) {
    console.error('Error in confirmDelete:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while confirming delete',
      error: error.message,
    });
  }
}

module.exports = {
  getStorageStats,
  requestDeleteToken,
  confirmDelete,
  getPeriodBounds,
  PROTECTED_COLLECTIONS,
};
