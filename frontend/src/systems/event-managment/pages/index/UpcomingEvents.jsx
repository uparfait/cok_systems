import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { UPCOMING_EVENTS } from "../../constants/ApiEndipoints";
import axios from "axios";
import ShowEventSkeleton from "./components/ShowEventSkeleton";
import ShowEventNotFound from "./components/ShowEventNotFound";
import ShowUpcoming from "./components/ShowUpcoming";
import { useOutletContext } from "react-router-dom";

export default function UpcomingEvents() {
  const [isLoading, setIsLoading] = useState(false);
  const [FetchError, SetFetchError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState(undefined);
  const [filter, setFilter] = useState(undefined);
  const [search, setSearch] = useState(undefined);
  const [searchField, SetSearchField] = useState(undefined);
  const [totalPages, SetTotalPages] = useState(1);
  const { UpcomingEventsData, setUpcomingEventsData } = useOutletContext();
  const [isEmpty, setIsEmpty] = useState(false);
  const { setActiveEvent } = useOutletContext();
  

  

  useEffect(() => {
    async function FetchUpcomingEvents() {
      try {
        if(initialLoad) { setIsLoading(true) }

        const response = await axios.get(UPCOMING_EVENTS.endpoint, {
          params: {
            page: page,
            limit: limit,
            sort: sort || undefined,
            filter: filter || undefined,
            search: search || undefined,
            searchField: searchField || undefined,
          }
        });

        if (response.data && response.data.success) {
          setUpcomingEventsData(response.data.data);
          SetTotalPages(response.data.totalPages);
          setPage(response.data.currentPage);

          if(response.data.data.length === 0) { setIsEmpty(true) }

         
        }

      } catch (error) {
        console.error(error);
        if(initialLoad){setIsEmpty(true);}
      } finally {
        setIsLoading(false);
        setInitialLoad(false);
      }
    }
    

    FetchUpcomingEvents()

    // 2. Safely attach it to the global window object
    window.ACTIVE_FUNCTION = FetchUpcomingEvents;
    return () => {
      window.ACTIVE_FUNCTION = undefined;
    };
  }, []); 

  return (
    <>
      <Helmet>
        <title>Upcoming Events</title>
        <meta
          name="description"
          content="Discover and attend in Upcoming Events happening right now!"
        />
      </Helmet>

      <main className="w-full min-h-[calc(100vh-80px)] pt-20 flex flex-col items-center bg-white px-4">
        <div className="w-full flex flex-col items-center gap-3">

          {
            isEmpty ? < ShowEventNotFound /> : UpcomingEventsData.length >= 1 ? UpcomingEventsData.map((Event)=> <ShowUpcoming event={Event} />) : <ShowEventSkeleton />
          }
          
        </div>
      </main>
    </>
  );
}
