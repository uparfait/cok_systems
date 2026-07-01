const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');

class GetScheduledEventsController {
  static async handle(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'new',
        search,
        searchField,
        filter
      } = req.query;

      // Fetch all event types
      const [liveEvents, upcomingEvents, recurringEvents] = await Promise.all([
        LiveEvent.find().lean(),
        UpcomingEvent.find().lean(),
        RecurringEvent.find({ 'eventRecurring.isExpired': false }).lean()
      ]);

      // Transform and combine events
      let allEvents = [];

      // Add live events
      liveEvents.forEach(event => {
        allEvents.push({
          ...event,
          eventStatus: 'live',
          startTime: event.startedAt,
          endTime: event.willEndAt,
          sourceCollection: 'LiveEvent'
        });
      });

      // Add upcoming events
      upcomingEvents.forEach(event => {
        allEvents.push({
          ...event,
          eventStatus: 'upcoming',
          startTime: event.willStartAt,
          endTime: event.willEndAt,
          sourceCollection: 'UpcomingEvent'
        });
      });

      // Add recurring events
      recurringEvents.forEach(event => {
        allEvents.push({
          ...event,
          eventStatus: 'recurring',
          startTime: event.eventStartDate,
          endTime: event.eventEndDate,
          sourceCollection: 'RecurringEvent'
        });
      });

      // Apply search
      if (search) {
        const searchLower = search.toLowerCase();
        if (searchField) {
          allEvents = allEvents.filter(event => 
            event[searchField] && 
            event[searchField].toString().toLowerCase().includes(searchLower)
          );
        } else {
          allEvents = allEvents.filter(event =>
            event.eventName?.toLowerCase().includes(searchLower) ||
            event.eventOrganizer?.toLowerCase().includes(searchLower) ||
            event.eventRoom?.toLowerCase().includes(searchLower)
          );
        }
      }

      // Apply filter
      if (filter) {
        const now = new Date();
        switch (filter) {
          case 'thisWeek':
            { const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            allEvents = allEvents.filter(event => 
              new Date(event.startTime) >= weekStart && 
              new Date(event.startTime) <= weekEnd
            );
            break; }
          case 'thisMonth':
            { const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            allEvents = allEvents.filter(event => 
              new Date(event.startTime) >= monthStart && 
              new Date(event.startTime) <= monthEnd
            );
            break; }
          case 'live':
            allEvents = allEvents.filter(event => event.eventStatus === 'live');
            break;
          case 'upcoming':
            allEvents = allEvents.filter(event => event.eventStatus === 'upcoming');
            break;
          case 'recurring':
            allEvents = allEvents.filter(event => event.eventStatus === 'recurring');
            break;
        }
      }

      // Sort events
      allEvents.sort((a, b) => {
        if (sort === 'old') {
          return new Date(a.startTime) - new Date(b.startTime);
        }
        return new Date(b.startTime) - new Date(a.startTime);
      });

      // Apply pagination
      const totalRecords = allEvents.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const startIndex = (page - 1) * limit;
      const paginatedEvents = allEvents.slice(startIndex, startIndex + parseInt(limit));

      return res.status(200).json({
        success: true,
        totalRecords,
        totalPages,
        currentPage: parseInt(page),
        data: paginatedEvents
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving scheduled events',
        error: error.message
      });
    }
  }
}

module.exports = GetScheduledEventsController;