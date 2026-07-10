const PostMeeting = require('../models/PostMeeting');
const LiveEvent = require('../models/LiveEvent');

class PostMeetingMinutesController {
  
  static async saveMinutes(req, res) {
    try {
      const { eventSpecialId } = req.params;
      const { meetingMinutes } = req.body;

      
      if (!eventSpecialId) {
        return res.status(400).json({
          success: false,
          message: 'Event special ID is required'
        });
      }

      if (!meetingMinutes || typeof meetingMinutes !== 'string' || !meetingMinutes.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Meeting minutes content is required and must be a non-empty string'
        });
      }

      // Find the live event to get event details
      const liveEvent = await LiveEvent.findOne({ eventSpecialId }).lean();

      if (!liveEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found with the provided special ID'
        });
      }

      // Find existing post-meeting record or create new one
      let postMeeting = await PostMeeting.findOne({ eventSpecialId });

      if (postMeeting) {
        // Update existing minutes
        postMeeting.meetingMinutes = meetingMinutes;
        await postMeeting.save();
      } else {
        // Create new post-meeting record with documenter details
        postMeeting = await PostMeeting.create({
          meetingMinutes,
          documentedBy: {
            name: 'Testing',
            role: 'Testing',
            institution: 'Testing Institution',
            email: 'Testing@gmail.com',
            phone: '12345678'
          },
          meetingDate: liveEvent.startedAt,
          eventSpecialId
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Meeting minutes saved successfully',
        data: postMeeting
      });

    } catch (error) {
      console.error('Error saving meeting minutes:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: messages
        });
      }

      // Handle duplicate key errors
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate record found'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error saving meeting minutes',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

 
  static async getMinutes(req, res) {
    try {
      const { eventSpecialId } = req.params;

      if (!eventSpecialId) {
        return res.status(400).json({
          success: false,
          message: 'Event special ID is required'
        });
      }

      // Find the live event first to ensure it exists
      const liveEvent = await LiveEvent.findOne({ eventSpecialId })
        .select('eventName eventSpecialId startedAt willEndAt eventOrganizer eventType')
        .lean();

      if (!liveEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found with the provided special ID'
        });
      }

      // Find post-meeting minutes
      const postMeeting = await PostMeeting.findOne({ eventSpecialId }).lean();

      if (!postMeeting) {
        // Return event info but indicate no minutes exist yet
        return res.status(200).json({
          success: true,
          message: 'No minutes found for this event yet',
          data: {
            event: liveEvent,
            minutes: null
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Meeting minutes retrieved successfully',
        data: {
          event: liveEvent,
          minutes: {
            content: postMeeting.meetingMinutes,
            documentedBy: postMeeting.documentedBy,
            meetingDate: postMeeting.meetingDate,
            lastUpdated: postMeeting.updatedAt,
            createdAt: postMeeting.createdAt,
            designatedMinutesTaker: postMeeting.designatedMinutesTaker
          }
        }
      });

    } catch (error) {
      console.error('Error fetching meeting minutes:', error);

      return res.status(500).json({
        success: false,
        message: 'Error fetching meeting minutes',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  static async designateMinutes(req, res) {
    try {
      const { eventSpecialId } = req.params;
      const { designatedEmail, designatedName } = req.body;

      if (!eventSpecialId) {
        return res.status(400).json({
          success: false,
          message: 'Event special ID is required'
        });
      }

      if (!designatedEmail || !designatedEmail.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Designated email is required'
        });
      }

      // Find the live event to ensure it exists
      const liveEvent = await LiveEvent.findOne({ eventSpecialId }).lean();

      if (!liveEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found with the provided special ID'
        });
      }

      // Find existing post-meeting record or create new one
      let postMeeting = await PostMeeting.findOne({ eventSpecialId });

      if (postMeeting) {
        // Update existing record with designated minutes taker
        postMeeting.designatedMinutesTaker = {
          name: designatedName || designatedEmail.split('@')[0],
          email: designatedEmail.trim(),
          designatedAt: new Date(),
          designatedBy: req.user?.email || 'system'
        };
        await postMeeting.save();
      } else {
        // Create new post-meeting record
        postMeeting = await PostMeeting.create({
          meetingMinutes: '',
          documentedBy: {
            name: 'Pending Designation',
            role: 'Pending',
            institution: 'Pending',
            email: 'pending@cok.rw',
            phone: ''
          },
          designatedMinutesTaker: {
            name: designatedName || designatedEmail.split('@')[0],
            email: designatedEmail.trim(),
            designatedAt: new Date(),
            designatedBy: req.user?.email || 'system'
          },
          meetingDate: liveEvent.startedAt,
          eventSpecialId
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Minutes responsibility designated successfully',
        data: {
          designatedMinutesTaker: postMeeting.designatedMinutesTaker
        }
      });

    } catch (error) {
      console.error('Error designating minutes:', error);

      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: messages
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error designating minutes responsibility',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = PostMeetingMinutesController;