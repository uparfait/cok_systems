
//events/upcoming?page=1&limit=10&sort=old&filter=thisMonth&search=conference&searchField=eventName
export const UPCOMING_EVENTS =  {
    endpoint: "/cok/api/v1/events/upcoming",
    method: "GET",
    queryParams: {
        page: null,
        limit: null,
        sort: null,
        filter: null,
        search: null,
        searchField: null
    }

}

export const GET_ALL_EVENTS = {
    endpoint: "/cok/api/v1/events/scheduled",
    method: "GET",
    queryParams: {
        page: null,
        limit: null
    }
}

export const GET_LIVE_EVENTS = {
    endpoint: '/cok/api/v1/events/live',
    method: "GET",
    queryParams: {
        page: null,
        limit: null,
        sort:null,
        filter: null,
        search:null,
        searchField: null
    }
}