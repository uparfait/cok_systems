import React, { useState, useEffect, useRef } from "react";
import { FiX, FiUser, FiPhone, FiMail, FiAward, FiCreditCard, FiSave, FiLoader } from "react-icons/fi";
import { useToast } from "../contexts/ToastContext";
import { serviceDeliveryService } from "../services/adminService";
import LoadingSpinner from "./LoadingSpinner";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";
import Transfer from "./Transfer";
import VisitorCompleteModal from "./VisitorCompleteModal";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface Visitor {
  _id?: string;
  id?: string;
  full_name?: string;
  name?: string;
  visitorName?: string;
  telephone?: string;
  email?: string;
  identification?: string | { id_type?: string; number?: string };
  gender?: string;
  badge_number?: string;
  vehicle_storage?: { has_vehicle?: boolean; vehicle_details?: { plate_number?: string } };
  status?: string;
  entry_date?: string;
  departments_assigned?: Array<{
    department_id: string;
    department_name?: string;
    status: string;
    provider_name?: string;
    provider_id?: string;
    assigned_time?: string;
  }>;
  services_status?: Array<{
    department_id: string;
    s_type?: string;
    provider_name?: string;
    provider_id?: string;
    started_at?: string;
  }>;
}

interface EmployeeVisitorClickedProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Visitor | null;
  myProviderId: string;
  onSaved?: () => void;
}

interface FormState {
  full_name: string;
  telephone: string;
  email: string;
  identification_number: string;
  id_type: string;
  gender: string;
  badge_number: string;
  has_vehicle: boolean;
  plate_number: string;
}

const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber || idNumber.trim() === "") return null;
  const trimmedId = idNumber.trim();
  if (idType === "National ID") {
    if (trimmedId.length !== 16) return "National ID must be 16_digits";
    if (!/^\d+$/.test(trimmedId)) return "National ID must contain only numbers";
  } else if (idType === "Passport") {
    if (trimmedId.length < 6) return "Passport number must be at least 6 characters";
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) return "Passport number must contain only letters and numbers";
  } else if (idType === "Driving Licence") {
    if (trimmedId.length < 8) return "Driving Licence must be at least 8 characters";
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) return "Driving Licence must contain only letters and numbers";
  }
  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === "") return null;
  const trimmedEmail = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) return "Please enter a valid email address";
  return null;
};

const EmployeeVisitorClicked: React.FC<EmployeeVisitorClickedProps> = ({
  isOpen,
  onClose,
  visitor,
  myProviderId,
  onSaved,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    full_name: "",
    telephone: "",
    email: "",
    identification_number: "",
    id_type: "National ID",
    gender: "",
    badge_number: "",
    has_vehicle: false,
    plate_number: "",
  });
  const [visitorDetails, setVisitorDetails] = useState<Visitor | null>(null);
  const [actionValue, setActionValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);

  const initialFormRef = useRef<FormState>(form);

  const myAssignment = visitorDetails?.departments_assigned?.find(
    (d: any) => String(d.provider_id) === myProviderId
  );
  const myServiceStatus = visitorDetails?.services_status?.find(
    (s: any) => String(s.provider_id) === myProviderId
  );
  const currentStatus = (myServiceStatus?.s_type || "Not started").toLowerCase();

  const isBeingServed = currentStatus === "inprogress";
  const isCompleted = currentStatus === "completed";

  const availableActions = [];
  if (isBeingServed) {
    availableActions.push({ value: "complete", label: "Complete" });
  } else if (!isCompleted) {
    availableActions.push({ value: "serve", label: "Serve Visitor" });
  }
  availableActions.push({ value: "transfer", label: "Transfer" });

  useEffect(() => {
    if (!isOpen) return;
    if (!visitor?._id) return;

    setFetching(true);
    serviceDeliveryService
      .getById(visitor._id)
      .then((res: any) => {
        if (res.success && res.data) {
          const d = res.data;
          setVisitorDetails(d);
          const loadedForm: FormState = {
            full_name: d.full_name || "",
            telephone: d.telephone || "",
            email: d.email || "",
            identification_number: d.identification?.number || "",
            id_type: d.identification?.id_type || "National ID",
            gender: d.gender || "",
            badge_number: d.badge_number || "",
            has_vehicle: d.vehicle_storage?.has_vehicle || false,
            plate_number: d.vehicle_storage?.vehicle_details?.plate_number || "",
          };
          setForm(loadedForm);
          initialFormRef.current = loadedForm;
          setIsEditing(false);
        }
      })
      .catch(() => showError("Failed to load visitor details"))
      .finally(() => setFetching(false));
  }, [isOpen, visitor, showError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const val = type === "checkbox" ? checked : value;
    setForm((prev) => ({ ...prev, [name]: val }));

    if (name === "id_type" || name === "identification_number") {
      const newIdType = name === "id_type" ? value : form.id_type;
      const newIdNumber = name === "identification_number" ? value : form.identification_number;
      setIdError(validateIdNumber(newIdType, newIdNumber));
    }

    if (name === "email") {
      setEmailError(validateEmail(value));
    }
  };

  const hasFieldChanged = (key: keyof FormState) => {
    if (key === "identification_number" || key === "id_type") {
      return (
        form.identification_number !== initialFormRef.current.identification_number ||
        form.id_type !== initialFormRef.current.id_type
      );
    }
    return form[key] !== initialFormRef.current[key];
  };

  const validate = (): boolean => {
    if (!form.full_name.trim() || !form.telephone.trim()) {
      showError("Please fill in required fields");
      return false;
    }
    const idValidationError = validateIdNumber(form.id_type, form.identification_number);
    if (idValidationError) {
      showError(idValidationError);
      return false;
    }
    const emailValidationError = validateEmail(form.email);
    if (emailValidationError) {
      showError(emailValidationError);
      return false;
    }
    return true;
  };

  const buildUpdatePayload = () => {
    const payload: any = {};
    if (hasFieldChanged("full_name")) payload.full_name = form.full_name.trim();
    if (hasFieldChanged("telephone")) payload.telephone = form.telephone.trim();
    if (hasFieldChanged("email")) payload.email = form.email.trim();
    if (hasFieldChanged("gender")) payload.gender = form.gender.trim();
    if (hasFieldChanged("badge_number")) payload.badge_number = form.badge_number.trim();
    if (hasFieldChanged("identification_number") || hasFieldChanged("id_type")) {
      payload.identification = { id_type: form.id_type.trim(), number: form.identification_number.trim() };
    }
    return payload;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = buildUpdatePayload();
      if (Object.keys(payload).length === 0) {
        showError("No changes detected");
        setLoading(false);
        return;
      }
      const res = await serviceDeliveryService.update(visitor!._id!, payload);
      if (res?.success || res?.status) {
        showSuccess("Visitor updated");
        onSaved?.();
        setIsEditing(false);
      } else {
        showError(res?.message || res?.error || "Operation failed");
      }
    } catch (err: any) {
      showError(err?.message || err?.error || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleServeVisitor = async () => {
    if (!visitor?._id) return;
    setActionLoading(true);
    try {
      const res = await serviceDeliveryService.updateServiceStatus({
        visitor_id: visitor._id,
        status: "Inprogress",
      });
      if (res?.success || res?.status) {
        showSuccess("Service started");
        onSaved?.();
      } else {
        showError(res?.message || res?.error || "Failed to start service");
      }
    } catch (err: any) {
      showError(err?.message || err?.error || "Request failed");
    } finally {
      setActionLoading(false);
      setActionValue("");
    }
  };

  const handleComplete = async (helpGiven: string) => {
    if (!visitor?._id) return;
    setCompleting(true);
    try {
      const res = await serviceDeliveryService.updateServiceStatus({
        visitor_id: visitor._id,
        status: "Completed",
        notes: helpGiven || "",
      });
      if (res?.success || res?.status) {
        showSuccess("Visit completed");
        setShowCompleteModal(false);
        onSaved?.();
        onClose();
      } else {
        showError(res?.message || res?.error || "Completion failed");
      }
    } catch (err: any) {
      showError(err?.message || err?.error || "Request failed");
    } finally {
      setCompleting(false);
    }
  };

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "transfer") {
      setShowTransfer(true);
    } else if (value === "complete") {
      setShowCompleteModal(true);
    } else if (value === "serve") {
      handleServeVisitor();
    }
    setActionValue("");
  };

  if (!isOpen) return null;

  const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };

  const renderVehicleSection = () => {
    if (isEditing) {
      return (
        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
            <input
              type="checkbox"
              name="has_vehicle"
              checked={form.has_vehicle}
              onChange={handleChange}
              className="h-4 w-4"
              style={{ accentColor: PRIMARY }}
            />
            <span className="text-sm font-semibold uppercase" style={{ fontFamily: "var(--cok-font-heading)", color: '#333' }}>
              Has Vehicle
            </span>
          </label>
          <div className="relative">
            <FiAward className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
            <input
              name="plate_number"
              value={form.plate_number || ""}
              onChange={handleChange}
              disabled
              className="cok-auth-input pr-3 py-3"
              style={{ paddingLeft: '2.5rem', backgroundColor: NEUTRAL_LIGHT, cursor: 'not-allowed' }}
              placeholder="Enter plate number"
            />
          </div>
        </div>
      );
    }

    const hasVehicle = initialFormRef.current.has_vehicle;
    const plate = initialFormRef.current.plate_number;
    return (
      <div className="mt-2">
        <label className="cok-auth-label">Vehicle</label>
        <div className="cok-auth-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="text-xs font-semibold uppercase px-2 py-1" style={{
            backgroundColor: hasVehicle ? 'rgba(76,175,80,0.12)' : 'rgba(158,158,158,0.12)',
            color: hasVehicle ? '#388E3C' : '#666',
            borderRadius: 0,
          }}>
            {hasVehicle ? 'YES' : 'NO'}
          </span>
          <span className="text-sm" style={{ color: '#555555' }}>
            {hasVehicle ? (plate || 'Unknown plate') : 'No vehicle'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center cok-logout-overlay">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl flex flex-col" style={{ borderRadius: 0 }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-20 cok-bg-primary px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-lg sm:text-xl uppercase tracking-wide" style={{
              fontFamily: "var(--cok-font-heading)",
              letterSpacing: '1px',
            }}>
              Visitor Details
            </h2>
            
          </div>
          <div className="flex items-center gap-3">
            {visitorDetails && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="relative cursor-pointer inline-flex h-6 w-11 items-center transition-colors"
                  style={{ borderRadius: 0 }}
                  aria-pressed={isEditing}
                >
                  <span
                    className="inline-block z-5 h-5 w-5 cok-primary-bg transition-transform duration-200"
                    style={{
                      transform: isEditing ? 'translateX(20px)' : 'translateX(2px)',
                      borderRadius: 990,
                    }}
                  />
                  <span
                    className="absolute inset-0 transition-colors duration-200"
                    style={{
                      borderRadius: 200,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </button>
                <div className="text-white text-xs font-semibold uppercase mr-1" style={{ fontFamily: "var(--cok-font-heading)", minWidth: '54px', textAlign: 'center' }}>
                  {isEditing ? 'EDIT ON' : 'EDIT OFF'}
                </div>
              </>
            )}
            <button
              onClick={() => {
                setIsEditing(false);
                setShowTransfer(false);
                setShowCompleteModal(false);
                onClose();
              }}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {fetching ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <LoadingSpinner message="Loading visitor..." />
          </div>
        ) : (
          <>
            {/* Visitor info form */}
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="cok-auth-label">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="cok-auth-input pr-3 py-3"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Enter full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">Telephone</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input
                      name="telephone"
                      value={form.telephone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="cok-auth-input pr-3 py-3"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="cok-auth-input pr-3 py-3"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Email address"
                    />
                    {emailError && <p className="mt-1 text-xs" style={{ color: '#E74C3C' }}>{emailError}</p>}
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">Badge Number</label>
                  <div className="relative">
                    <FiAward className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input
                      name="badge_number"
                      value={form.badge_number}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="cok-auth-input pr-3 py-3"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Badge number"
                    />
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">ID Type</label>
                  <select
                    name="id_type"
                    value={form.id_type}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="cok-auth-input pr-3 py-3"
                  >
                    <option value="National ID">National ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving Licence">Driving Licence</option>
                  </select>
                </div>

                <div>
                  <label className="cok-auth-label">ID Number</label>
                  <div className="relative">
                    <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input
                      name="identification_number"
                      value={form.identification_number}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="cok-auth-input pr-3 py-3"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder={form.id_type === 'National ID' ? 'Enter 16_digit national ID' : 'Enter ID number'}
                    />
                    {idError && <p className="mt-1 text-xs" style={{ color: '#E74C3C' }}>{idError}</p>}
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">Gender</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="cok-auth-input pr-3 py-3"
                  >
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="cok-auth-label">Service Status</label>
                  <div className="cok-auth-input flex items-center justify-between py-3">
                    <span className="text-xs font-bold uppercase" style={{
                      color: currentStatus === "inprogress" ? SUCCESS : currentStatus === "completed" ? "#555" : WARNING,
                    }}>
                      {currentStatus === "inprogress" ? "In Progress" : currentStatus === "completed" ? "Completed" : currentStatus === "transfered" ? "Transferred" : currentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {renderVehicleSection()}
            </div>

            {/* Action buttons */}
            <div className="p-4 sm:p-6 border-t" style={{ borderColor: '#E0E0E0' }}>
              {!isEditing ? (
                <div className="w-full">
                  <label className="block mb-1 text-xs font-semibold uppercase" style={{ color: TERTIARY, fontFamily: fontHeading }}>
                    Select what to do
                  </label>
                  <div className="relative">
                    <select
                      value={actionValue}
                      onChange={handleActionChange}
                      className="cok-auth-input w-full text-sm appearance-none pr-10 h-10"
                      style={{ fontFamily: fontHeading, padding: "0.6rem 1rem" }}
                      disabled={availableActions.length === 0 || actionLoading || completing}
                    >
                      <option value="">Select action...</option>
                      {availableActions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {(actionLoading || completing) && (
                      <FiLoader className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: PRIMARY }} />
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="cok-btn-primary flex items-center justify-center gap-2 h-10 w-full sm:w-auto"
                  style={{ padding: "0.6rem 1rem", ...btnTypography }}
                >
                  {loading ? <SpiralLoader color="#FFFFFF" /> : <FiSave className="w-4 h-4" />}
                  {loading ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </>
        )}

        {/* Transfer modal */}
        {showTransfer && visitorDetails && visitor?._id && (
          <Transfer
            visitorId={visitor._id}
            visitorName={visitorDetails.full_name || visitorDetails.name}
            visitorEmail={visitorDetails.email}
            visitorTelephone={visitorDetails.telephone}
            onClose={() => setShowTransfer(false)}
            onAssigned={onSaved}
          />
        )}

        {/* Complete modal */}
        <VisitorCompleteModal
          isOpen={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          onConfirm={handleComplete}
          visitorName={visitorDetails?.full_name || visitorDetails?.name}
          completing={completing}
        />
      </div>
    </div>
  );
};

export default EmployeeVisitorClicked;
