/**
 * Lock/Unlock Account Controller
 * Handles locking and unlocking user accounts
 */

const User = require("../../../models/user");

/**
 * POST /auth/lock-unlock
 * Lock or unlock a user account
 */
async function lockUnlockAccount(req, res, next) {
  try {
    const { userId, action, reason } = req.body || {};

    // Validate required fields
    if (!userId || !action) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "User ID and action are required"
      });
    }

    // Validate action
    if (!['lock', 'unlock'].includes(action)) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "Action must be 'lock' or 'unlock'"
      });
    }

    // Get user from database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        type: "warning",
        message: "User not found"
      });
    }

    // Initialize access_control if not exists
    if (!user.access_control) {
      user.access_control = {
        is_locked: false,
        reason: null,
        last_login_attempt: 0
      };
    }

    if (action === 'lock') {
      // Lock the account
      if (user.access_control.is_locked) {
        return res.status(400).json({
          success: false,
          type: "warning",
          message: "Account is already locked"
        });
      }

      user.access_control.is_locked = true;
      user.access_control.reason = reason || 'Account locked by administrator';
      
      await user.save();

      return res.status(200).json({
        success: true,
        type: "success",
        message: "Account locked successfully",
        data: {
          userId: user._id,
          email: user.email,
          fullName: user.full_name,
          isLocked: user.access_control.is_locked,
          reason: user.access_control.reason
        }
      });

    } else if (action === 'unlock') {
      // Unlock the account
      if (!user.access_control.is_locked) {
        return res.status(400).json({
          success: false,
          type: "warning",
          message: "Account is not locked"
        });
      }

      user.access_control.is_locked = false;
      user.access_control.reason = null;
      user.access_control.last_login_attempt = 0; // Reset login attempts on unlock
      
      await user.save();

      return res.status(200).json({
        success: true,
        type: "success",
        message: "Account unlocked successfully",
        data: {
          userId: user._id,
          email: user.email,
          fullName: user.full_name,
          isLocked: user.access_control.is_locked
        }
      });
    }

  } catch (error) {
    console.error("Error in lockUnlockAccount:", error);
    next(error);
  }
}

/**
 * POST /auth/lock-unlock/status
 * Check account lock status
 */
async function checkLockStatus(req, res, next) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "User ID is required"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        type: "warning",
        message: "User not found"
      });
    }

    const isLocked = user.access_control?.is_locked || false;
    const lockReason = user.access_control?.reason || null;
    const lastLoginAttempt = user.access_control?.last_login_attempt || 0;

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Account lock status retrieved",
      data: {
        userId: user._id,
        email: user.email,
        fullName: user.full_name,
        isLocked: isLocked,
        reason: lockReason,
        lastLoginAttempt: lastLoginAttempt
      }
    });

  } catch (error) {
    console.error("Error in checkLockStatus:", error);
    next(error);
  }
}

/**
 * POST /auth/lock-unlock/reset-attempts
 * Reset login attempts for a user
 */
async function resetLoginAttempts(req, res, next) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "User ID is required"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        type: "warning",
        message: "User not found"
      });
    }

    // Initialize access_control if not exists
    if (!user.access_control) {
      user.access_control = {
        is_locked: false,
        reason: null,
        last_login_attempt: 0
      };
    }

    user.access_control.last_login_attempt = 0;
    await user.save();

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Login attempts reset successfully",
      data: {
        userId: user._id,
        email: user.email,
        lastLoginAttempt: 0
      }
    });

  } catch (error) {
    console.error("Error in resetLoginAttempts:", error);
    next(error);
  }
}

module.exports = {
  lockUnlockAccount,
  checkLockStatus,
  resetLoginAttempts
};
