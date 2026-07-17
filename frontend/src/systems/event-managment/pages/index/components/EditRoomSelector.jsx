import { useState, useEffect } from "react";
import axios from "axios";
import { FiAlertCircle, FiCheck, FiMapPin } from "react-icons/fi";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";


const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";

const fontHeading = "'Montserrat', sans-serif";

function EditRoomSelector({ editForm, setEditForm, requestId }) {
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
      <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
        <p className="text-xs" style={{ color: "#E74C3C", fontFamily: fontHeading }}>
          {error}
        </p>
      </div>
    );
  if (rooms.length === 0)
    return (
      <div className="p-6 text-center" style={{ backgroundColor: "#FFF3E0", border: "1px solid #FFCC80" }}>
        <FiAlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: WARNING }} />
        <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          All Rooms Occupied
        </p>
        <p className="text-xs mt-2" style={{ color: WARNING, fontFamily: fontHeading }}>
          Change your schedule.
        </p>
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
            className="w-full text-left p-3 border-2 transition-all"
            style={
              selected
                ? { borderColor: SUCCESS, backgroundColor: "#E8F5E9", boxShadow: "0 0 0 2px #C8E6C9" }
                : { borderColor: "#A5D6A7", backgroundColor: WHITE }
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <FiCheck
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: selected ? SUCCESS : "#81C784" }}
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
                    style={{ color: "#757575", fontFamily: fontHeading }}
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
                  className="text-xs font-bold px-2.5 py-0.5"
                  style={{ color: "#2E7D32", backgroundColor: "#C8E6C9", border: "1px solid #A5D6A7" }}
                >
                  Selected
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default EditRoomSelector;
