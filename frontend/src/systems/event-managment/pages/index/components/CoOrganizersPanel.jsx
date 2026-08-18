import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { FiX } from "react-icons/fi";
import { useToast } from "@/core/contexts/ToastContext";
import { employeeService } from "@/core/services/employeeService";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const GRAY_DISABLED = "#9E9E9E";
const NEUTRAL_LIGHT = "#F7F9FB";
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = "w-full cok-auth-input pr-3 py-2 text-sm";
const inputStyle = { paddingLeft: "12px" };

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: NEUTRAL_DARK,
  display: "block",
  marginBottom: "6px",
};

export default function CoOrganizersPanel({ eventSpecialId }) {
  const { showSuccess, showError } = useToast();

  const [coOrganizers, setCoOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [showPicker, setShowPicker] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef(null);

  const [form, setForm] = useState({ fullNames: "", email: "", phone: "", institution: "City of Kigali" });

  const fetchCoOrganizers = useCallback(async () => {
    if (!eventSpecialId) return;
    try {
      const res = await axios.get(`/cok/api/v1/events/${eventSpecialId}/co-organizers`);
      if (res.data?.success) setCoOrganizers(res.data.data || []);
    } catch {
      setCoOrganizers([]);
    } finally {
      setLoading(false);
    }
  }, [eventSpecialId]);

  useEffect(() => { fetchCoOrganizers(); }, [fetchCoOrganizers]);

  useEffect(() => {
    if (!showPicker) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = employeeSearch.trim();
    if (!q) { setEmployees([]); return; }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await employeeService.search(q, 1, 20);
        setEmployees(res?.data || []);
      } catch {
        setEmployees([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [employeeSearch, showPicker]);

  const pickEmployee = (emp) => {
    setForm({
      fullNames: emp.full_name || "",
      email: emp.email || "",
      phone: emp.telephone || "",
      institution: "City of Kigali",
    });
    setShowPicker(false);
    setEmployeeSearch("");
    setEmployees([]);
  };

  const openModal = () => {
    setForm({ fullNames: "", email: "", phone: "", institution: "City of Kigali" });
    setFormError(null);
    setShowPicker(false);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await axios.post(`/cok/api/v1/events/${eventSpecialId}/co-organizers`, form);
      if (res.data?.success) {
        setCoOrganizers(res.data.data || []);
        showSuccess(res.data.message || "Co-organizer added");
        setShowModal(false);
      } else {
        setFormError(res.data?.message || "Failed to add co-organizer");
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to add co-organizer";
      setFormError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full mt-6 p-5 border rounded-none" style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold" style={{ fontFamily: fontHeading }}>
          Co-organizers
        </h3>
        <button
          type="button"
          onClick={openModal}
          className="cok-btn-primary"
          style={{ width: "auto", padding: "0.4rem 0.8rem", fontSize: "11px" }}
        >
          Add Co-organiser
        </button>
      </div>

      {loading ? (
        <p className="text-sm py-4 text-center" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Loading...</p>
      ) : coOrganizers.length === 0 ? (
        <p className="text-sm py-4 text-center border" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
          No co-organizers yet.
        </p>
      ) : (
        <div className="overflow-x-auto border" style={{ borderColor: BORDER }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: PRIMARY }}>
                {["Name", "Email", "Telephone"].map((h) => (
                  <th key={h} className="px-3 py-2.5 sm:px-4 text-left text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "#FFFFFF", fontFamily: fontHeading }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coOrganizers.map((c, i) => (
                <tr key={c.email || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-2.5 sm:px-4 whitespace-nowrap border-b font-medium" style={{ borderColor: BORDER, color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {c.fullNames || "-"}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: BORDER, color: "#555555" }}>
                    {c.email || "-"}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: BORDER, color: "#555555" }}>
                    {c.phone || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-start justify-center px-2 sm:px-4 pb-6 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.5)", paddingTop: "96px", zIndex: 100000001 }}>
          <div className="bg-white w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 sticky top-0 z-10 text-white" style={{ backgroundColor: PRIMARY }}>
              <h3 className="text-base font-bold" style={{ fontFamily: fontHeading }}>Add Co-organiser</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="cok-btn-outlined-reverse disabled:opacity-50"
                style={{ padding: "0.4rem 0.8rem" }}
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
              <p className="text-center text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                Fields marked with <span style={{ color: DANGER }}>*</span> are required</p>
              {formError && (
                <p className="p-3 text-sm" style={{ backgroundColor: "#FDECEA", border: "1px solid #F5B7B1", color: DANGER, fontFamily: fontHeading }}>{formError}</p>
              )}

              <button
                type="button"
                onClick={() => setShowPicker((p) => !p)}
                className="cok-btn-outlined"
                style={{ padding: "0.45rem 1rem" }}
              >
                {showPicker ? "Hide employee search" : "Pick from employees"}
              </button>

              {showPicker && (
                <div style={{ border: `1px solid ${BORDER}` }}>
                  <div className="p-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <input
                      type="text"
                      placeholder="Search employee by email or phone"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      autoFocus
                      className="w-full cok-auth-input pr-3 py-1.5 text-xs"
                      style={{ paddingLeft: "12px" }}
                    />
                  </div>
                  <ul className="max-h-44 overflow-y-auto bg-white">
                    {searching ? (
                      <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>Searching...</li>
                    ) : employees.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>
                        {employeeSearch.trim() ? "No employees found" : "Type an email or phone number to search"}
                      </li>
                    ) : employees.map((emp) => (
                      <li key={emp._id || emp.email}>
                        <button
                          type="button"
                          onClick={() => pickEmployee(emp)}
                          className="w-full text-left px-3 sm:px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                          style={{ borderBottom: `1px solid ${BORDER}` }}
                        >
                          <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{emp.full_name}</p>
                          <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                            {[emp.title, emp.telephone].filter(Boolean).join(", ")}
                          </p>
                          <p className="text-xs mt-0.5 break-all" style={{ color: PRIMARY }}>{emp.email}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Full Names <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="text" required maxLength={200}
                    value={form.fullNames}
                    onChange={(e) => setForm((p) => ({ ...p, fullNames: e.target.value }))}
                    placeholder="Full names"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email Address <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="email" required maxLength={300}
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email address"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="tel" required
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone number"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Institution</label>
                  <input
                    type="text" maxLength={300}
                    value={form.institution}
                    onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))}
                    placeholder="Institution"
                    className={inputClassName} style={inputStyle}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="cok-btn-outlined disabled:opacity-50"
                  style={{ padding: "0.6rem 1.2rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cok-btn-primary sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ width: "100%", padding: "0.6rem 1.4rem" }}
                >
                  {submitting ? "Adding..." : "Add Co-organiser"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
