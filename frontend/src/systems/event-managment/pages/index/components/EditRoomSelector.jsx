import { useState, useEffect } from "react";
import axios from "axios";
import { FiAlertCircle, FiCheck, FiMapPin } from "react-icons/fi";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";


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

function EditRoomSelector({ editForm, setEditForm, requestId, errors, onBack }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      if (!editForm.startTime || !editForm.endTime) return;
      setLoading(true);
      try {
        const params = {
          startTime: new Date(editForm.startTime).toISOString(),
          endTime: new Date(editForm.endTime).toISOString(),
          eventMode: "upcoming",
          ...(requestId ? { requestId } : {}),
        };
        const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
        const data = res.data?.data || res.data;
        setRooms(data.availableRooms || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to check");
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [editForm.startTime, editForm.endTime, requestId]);

  const isSelected = (name) => editForm.eventRoom?.toLowerCase() === name.toLowerCase();

  if (loading)
    return (
      <div className="flex items-center justify-center py-6">
       <SpiralLoader />
        <span className="ml-2 text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          Checking rooms...
        </span>
      </div>
    );
  if (error)
    return (
      <div className="p-3" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}>
        <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>
          {error}
        </p>
      </div>
    );
  if (rooms.length === 0)
    return (
      <div className="p-6 text-center" style={{ backgroundColor: '#FFF3E0', border: `1px solid #FFCC80` }}>
        <FiAlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: WARNING }} />
        <p className="text-sm font-bold mb-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          All Rooms Are Occupied
        </p>
        <p className="text-xs mb-3" style={{ color: WARNING, fontFamily: fontHeading }}>
          No rooms are available for the selected schedule: {new Date(editForm.startTime).toLocaleString()} - {new Date(editForm.endTime).toLocaleString()}
        </p>
        <button
          type="button"
          onClick={() => onBack && onBack()}
          className="text-xs font-semibold uppercase tracking-wide text-white px-4 py-2 transition-colors"
          style={{ backgroundColor: WARNING, fontFamily: fontHeading }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e08e00'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = WARNING}
        >
          Choose Different Dates
        </button>
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold mb-2" style={{ color: SUCCESS, fontFamily: fontHeading }}>
        Available Rooms ({rooms.length})
      </p>
      {rooms.map((item, idx) => {
        const selected = isSelected(item.room.roomName);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setEditForm((p) => ({ ...p, eventRoom: item.room.roomName }))}
            className="w-full text-left p-3 transition-all"
            style={
              selected
                ? { border: `1px solid ${SUCCESS_HOVER}`, backgroundColor: '#E8F5E9', boxShadow: '0px 4px 8px rgba(76,175,80,0.25)', cursor: 'pointer' }
                : { border: `1px solid ${BORDER}`, backgroundColor: WHITE, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer' }
            }
            onMouseEnter={(e) => { if (!isSelected(item.room.roomName)) e.currentTarget.style.borderColor = PRIMARY; }}
            onMouseLeave={(e) => { if (!isSelected(item.room.roomName)) e.currentTarget.style.borderColor = BORDER; }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <FiCheck
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: selected ? SUCCESS : '#81C784' }}
                />
                <div>
                  <p
                    className="text-sm font-semibold capitalize"
                    style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
                  >
                    {item.room.roomName}
                  </p>
                  <div
                    className="flex gap-3 mt-0.5 text-xs"
                    style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}
                  >
                    <span className="flex items-center gap-1">
                      <FiMapPin className="w-3 h-3" />
                      {item.room.roomLocation}
                    </span>
                    <span>Capacity: {item.room.roomCapacity}</span>
                  </div>
                </div>
              </div>
              {selected && (
                <span
                  className="text-xs font-bold px-2.5 py-0.5 shrink-0"
                  style={{ color: WHITE, backgroundColor: SUCCESS }}
                >
                  Selected
                </span>
              )}
            </div>
          </button>
        );
      })}
      {errors?.room && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{errors.room}</p>}
    </div>
  );
}

export default EditRoomSelector;
