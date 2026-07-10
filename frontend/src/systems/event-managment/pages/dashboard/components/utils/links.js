// utils/links.ts or wherever SideBarLinks is saved
export default function SideBarLinks() {
  return [
    {
      id: "dashboard",
      name: "Dashboard",
      pathname: "/event-manager",
      icon: "FiBarChart2",
    },
    {
      id: "rooms",
      name: "Rooms",
      pathname: "/event-manager/rooms",
      icon: "FiLayers",
      children: [
        {
          id: "all-rooms",
          name: "All Rooms",
          pathname: "/event-manager/rooms/all",
          icon: "FiList",
        },
        {
          id: "rooms-analytics",
          name: "Analytics",
          pathname: "/event-manager/rooms/stats",
          icon: "FiBarChart2",
        },
        {
          id: "new-room",
          name: "New Room",
          pathname: "/event-manager/rooms/new",
          icon: "FiClipboard",
        },
        {
          id: "check-availability",
          name: "Check Availability",
          pathname: "/event-manager/rooms/availability",
          icon: "FiCheck",
        },
        {
          id: "date-check",
          name: "Date Check",
          pathname: "/event-manager/rooms/date-check",
          icon: "FiCalendar",
        },
      ],
    },
    {
      id: "events",
      name: "Events",
      pathname: "/event-manager/events",
      icon: "FiActivity",
      children: [
        {
          id: "live-events",
          name: "Live",
          pathname: "/event-manager/events/live",
          icon: "FiActivity",
        },
        {
          id: "upcoming-events",
          name: "Upcoming",
          pathname: "/event-manager/events/upcoming",
          icon: "FiArrowRight",
        },
        {
          id: "recurring-events",
          name: "Recurring",
          pathname: "/event-manager/events/recurring",
          icon: "FiGrid",
        },
        {
          id: "past-events",
          name: "Completed",
          pathname: "/event-manager/events/past",
          icon: "FiFile",
        },
        {
          id: "new-event",
          name: "New",
          pathname: "/event-manager/events/new",
          icon: "FiClipboard",
        },
        {
          id: "event-actions",
          name: "Actions",
          pathname: "/event-manager/events/actions",
          icon: "FiCheck",
        },

      ],
    },
    {
      id: "booking-requests",
      name: "Booking Requests",
      pathname: "/event-manager/booking-requests",
      icon: "FiClipboard",
      children: [
        {
          id: "all-requests",
          name: "All Requests",
          pathname: "/event-manager/booking-requests/all",
          icon: "FiList",
        },
      ],
    },
  ];
}