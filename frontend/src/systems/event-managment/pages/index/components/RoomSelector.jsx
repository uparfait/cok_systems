import { useEffect, useState } from "react";
import axios from "axios";
import { FiAlertCircle, FiCalendar, FiCheckCircle, FiMapPin } from "react-icons/fi";

import SpiralLoader from "../../../components/SpiralLoader";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const DANGER = "#E74C3C";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";

const fontHeading = "'Montserrat', sans-serif";

function RoomSelector({ form, rooms, audience, onChange, startTime, endTime, eventMeetingType, onBack }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [unavailableRooms, setUnavailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [tryAgain, setTryAgain] = useState("0.0001");

  const hasDates = startTime && endTime;

  const displayedAvailable = (availableRooms || []).filter(
    (item) => !audience || Number(item.room?.roomCapacity) >= Number(audience)
  );
  const selectedRoomVisible = form.room && displayedAvailable.length > 0 && !displayedAvailable.find((r) => r.room.roomName.toLowerCase() === form.room.toLowerCase());

  useEffect(() => {
    if (!hasDates) return;
    const checkRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          eventMode: "upcoming",
        };
        const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
        const data = res.data?.data || res.data;
        setAvailableRooms(data.availableRooms || []);
        setUnavailableRooms(data.unavailableRooms || []);
        setSearched(true);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to check availability");
      } finally {
        setLoading(false);
      }
    };
    checkRooms();
  }, [startTime, endTime, hasDates, tryAgain]);

  const isSelected = (roomName) => form.room?.toLowerCase() === roomName.toLowerCase();

  const btnHover = (e, bg) => { e.currentTarget.style.backgroundColor = bg; };
  const btnLeave = (e, bg) => { e.currentTarget.style.backgroundColor = bg; };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Room Selection</h2>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <SpiralLoader />
        </div>
      )}

      {error && (
        <div className="p-3 flex items-start gap-2 relative" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}>
          <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: DANGER }} />
          <p className="text-xs" style={{ color: '#C62828', fontFamily: fontHeading }}>{error}</p>
          <div className="text-xs absolute right-3 cursor-pointer text-[#c65228] hover:underline" onClick={()=> setTryAgain(`${Math.random()}`)}>Try again</div>
        </div>
      )}

      {!hasDates && !loading && (
        <div className="p-4 text-center" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
          <FiCalendar className="w-6 h-6 mx-auto mb-2" style={{ color: '#BDBDBD' }} />
          <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Set your schedule first, then rooms will be checked automatically.</p>
        </div>
      )}

      {hasDates && !loading && searched && (
        <div className="space-y-3">
          {selectedRoomVisible && (
            <div className="p-3" style={{ backgroundColor: '#FFF3E0', border: `1px solid #FFCC80` }}>
              <p className="text-xs font-medium" style={{ color: WARNING, fontFamily: fontHeading }}>
                Previously selected room "{form.room}" is no longer available with current settings.
              </p>
            </div>
          )}
          {displayedAvailable.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: SUCCESS, fontFamily: fontHeading }}>
                Available Rooms ({displayedAvailable.length})
              </p>
              <div className="space-y-2">
                {displayedAvailable.map((item, idx) => {
                  const selected = isSelected(item.room.roomName);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onChange("room", item.room.roomName)}
                      className="w-full text-left p-3 sm:p-4 transition-all"
                      style={
                        selected
                          ? { border: '1px solid #388E3C', backgroundColor: '#E8F5E9', boxShadow: '0px 4px 8px rgba(76,175,80,0.25)', cursor: 'pointer' }
                          : { border: `1px solid ${BORDER}`, backgroundColor: WHITE, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer' }
                      }
                      onMouseEnter={(e) => { if (!isSelected(item.room.roomName)) e.currentTarget.style.borderColor = PRIMARY; }}
                      onMouseLeave={(e) => { if (!isSelected(item.room.roomName)) e.currentTarget.style.borderColor = BORDER; }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <FiCheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: selected ? SUCCESS : '#81C784' }} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold capitalize truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{item.room.roomName}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                              <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 shrink-0" /> {item.room.roomLocation}</span>
                              <span>Capacity: {item.room.roomCapacity}</span>
                            </div>
                          </div>
                        </div>
                        {selected && <span className="text-xs font-bold px-2.5 py-0.5 shrink-0" style={{ color: WHITE, backgroundColor: SUCCESS }}>Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {displayedAvailable.length === 0 && (
            <div className="p-6 text-center" style={{ backgroundColor: '#FFF3E0', border: `1px solid #FFCC80` }}>
              <FiAlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: WARNING }} />
              <p className="text-sm font-bold mb-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                {availableRooms.length === 0 ? 'All Rooms Are Occupied' : 'No Rooms Match Capacity'}
              </p>
              <p className="text-xs mb-3" style={{ color: WARNING, fontFamily: fontHeading }}>
                {availableRooms.length === 0
                  ? `No rooms are available for the selected schedule: ${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}`
                  : `No available room can accommodate the expected audience of ${audience}.`}
              </p>
              <button
                type="button"
                onClick={() => onBack && onBack()}
                className="text-xs font-semibold uppercase tracking-wide text-white px-4 py-2 transition-colors"
                style={{ backgroundColor: WARNING, fontFamily: fontHeading }}
                onMouseEnter={(e) => btnHover(e, '#e08e00')}
                onMouseLeave={(e) => btnLeave(e, WARNING)}
              >
                Choose Different Dates
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoomSelector;
