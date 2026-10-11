import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FiUser, FiMail, FiPhone, FiCalendar, FiShield,   FiLock, FiEye, FiEyeOff,
  FiX, FiBriefcase, FiBell, FiEdit3, FiUploadCloud, FiAlertTriangle
} from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { useAuth } from "../../core/contexts/AuthContext";
import { useToast } from "../../core/contexts/ToastContext";
import {
  getUserProfile, changePassword, getNotificationSettings, updateNotificationSettings,
  getSigningProfile, uploadSignatureImage, deleteSignatureImage,
  uploadSigningCertificate, deleteSigningCertificate
} from "../../core/services/authService";
import { getSubscriptionStatus, subscribeToPush, unsubscribeFromPush } from "../../core/services/webPushService";
import SignaturePad from "./SignaturePad.jsx";
import OverlayShell from "./overlay/OverlayShell";

const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const MAX_SIGNATURE_IMAGE_BYTES = 200000;
// Backend cap for the stored .p12/.pfx container
const MAX_CERTIFICATE_BYTES = 65536;

const formatCertificateDate = (value: string | null | undefined) => {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleDateString();
};

// Raw base64 of the file, without the data URL prefix
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });

const dataUrlByteSize = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const DEFAULT_BACKGROUND_THRESHOLD = 200;
const BACKGROUND_FADE_BAND = 40;

const removeSignatureBackground = (dataUrl: string, threshold: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not available'));
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = frame.data;
      const fadeStart = threshold - BACKGROUND_FADE_BAND;
      for (let i = 0; i < px.length; i += 4) {
        const brightness = (px[i] + px[i + 1] + px[i + 2]) / 3;
        if (brightness >= threshold) {
          px[i + 3] = 0;
        } else if (brightness > fadeStart) {
          px[i + 3] = Math.round(px[i + 3] * (1 - (brightness - fadeStart) / BACKGROUND_FADE_BAND));
        }
      }
      ctx.putImageData(frame, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not decode the selected image'));
    img.src = dataUrl;
  });

interface UserProfile {
  _id: string;
  full_name: string;
  email: string;
  telephone?: string;
  picture?: string;
  gender?: string;
  title?: string;
  department?: {
    _id: string;
    department_name: string;
    department_id: string;
  };
  roles?: {
    role_name: string;
    permissions: any[];
  };
  is_active: boolean;
  created_date: string;
  is_account_activated: boolean;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface SigningCertificateSummary {
  file_name: string;
  subject_common_name: string;
  subject_email: string;
  issuer_common_name: string;
  serial_number: string;
  valid_from: string | null;
  valid_to: string | null;
  uploaded_at: string | null;
}

interface SigningProfile {
  has_signature_image: boolean;
  signature_image: string | null;
  has_signing_certificate?: boolean;
  signing_certificate?: SigningCertificateSummary | null;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'signature'>('profile');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [fetching, setFetching] = useState(false);
  const [notificationSubscribed, setNotificationSubscribed] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationChecking, setNotificationChecking] = useState(false);
  const [accountNotifEnabled, setAccountNotifEnabled] = useState(true);
  const [accountNotifLoading, setAccountNotifLoading] = useState(false);
  const [signingProfile, setSigningProfile] = useState<SigningProfile | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [imageReplaceMode, setImageReplaceMode] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState(false);
  const [drawnSignature, setDrawnSignature] = useState('');
  const [padKey, setPadKey] = useState(0);
  const [savingSignature, setSavingSignature] = useState(false);
  const [removingSignature, setRemovingSignature] = useState(false);
  const [pendingUpload, setPendingUpload] = useState('');
  const [pendingPreview, setPendingPreview] = useState('');
  const [transparentBackground, setTransparentBackground] = useState(true);
  const [backgroundThreshold, setBackgroundThreshold] = useState(DEFAULT_BACKGROUND_THRESHOLD);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  // Certificate awaiting its password check; the password lives here only until the server answers
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [showCertificatePassword, setShowCertificatePassword] = useState(false);
  const [savingCertificate, setSavingCertificate] = useState(false);
  const [removingCertificate, setRemovingCertificate] = useState(false);
  const certificateInputRef = useRef<HTMLInputElement>(null);
  const certificatePasswordRef = useRef<HTMLInputElement>(null);

  const roleNames: { [key: string]: string } = {
    'system_admin': 'System Administrator',
    'department_admin': 'Department Admin',
    'department_leader': 'Department Leader',
    'department_employee': 'Employee',
    'security_guard': 'Security Guard',
    'visitor': 'Visitor',
  };

  const getRoleDisplayName = (role?: string) => {
    if (!role) return 'N/A';
    return roleNames[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUserRole = () => {
    if (profileData?.roles?.role_name) {
      return profileData.roles.role_name;
    }
    return user?.role || '';
  };

  const displayName = profileData?.full_name || user?.fullName || 'User';
  const displayEmail = profileData?.email || user?.email || '';
  const departmentName = profileData?.department?.department_name || user?.departmentName || user?.department_name || '';
  const role = getUserRole();

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarColors = [
    '#2563eb', '#05966a', '#dc2626', '#ca8a04', '#7c3aed',
    '#db2777', '#0d9488', '#ea580c', '#0891b2', '#475569',
  ];
  const getAvatarColor = (name: string) => {
    const idx = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[idx];
  };

  const fetchProfile = useCallback(async () => {
    if (!user?.userId) return;
    setFetching(true);
    try {
      const response = await getUserProfile(user.userId);
      if ((response.success || response.status) && response.data) {
        setProfileData(response.data);
      } else {
        showError(response?.message || response?.error || "Failed to load profile");
        setProfileData(null);
      }
    } catch (error: any) {
      showError(error?.message || error?.error || "Failed to load profile");
      setProfileData(null);
    } finally {
      setFetching(false);
    }
  }, [user?.userId, showError]);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      checkNotificationStatus();
      fetchAccountNotificationSetting();
    }
  }, [isOpen, fetchProfile]);

  const fetchAccountNotificationSetting = async () => {
    try {
      const response = await getNotificationSettings();
      if ((response.success || response.status) && response.data) {
        setAccountNotifEnabled(response.data.notifications_enabled !== false);
      }
    } catch (err) {
      console.error('Error loading notification settings:', err);
    }
  };

  const handleToggleAccountNotifications = async () => {
    setAccountNotifLoading(true);
    try {
      const next = !accountNotifEnabled;
      const response = await updateNotificationSettings(next);
      if (response.success || response.status) {
        setAccountNotifEnabled(next);
        showSuccess(next ? 'Account notifications enabled' : 'Account notifications disabled');
      } else {
        showError(response?.message || 'Failed to update notification settings');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to update notification settings');
    } finally {
      setAccountNotifLoading(false);
    }
  };

  const checkNotificationStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotificationSubscribed(false);
      return;
    }
    setNotificationChecking(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setNotificationSubscribed(!!sub);
    } catch (err) {
      console.error('Error checking notification status:', err);
      setNotificationSubscribed(false);
    } finally {
      setNotificationChecking(false);
    }
  }, []);

  const handleToggleNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showError('Push notifications are not supported in this browser');
      return;
    }

    setNotificationLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        await unsubscribeFromPush(sub);
        setNotificationSubscribed(false);
        showSuccess('Notifications disabled');
      } else {
        await subscribeToPush(registration);
        setNotificationSubscribed(true);
        showSuccess('Notifications enabled');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to update notification settings');
    } finally {
      setNotificationLoading(false);
    }
  };

  const loadSigningProfile = useCallback(async (silent = false) => {
    if (!silent) setSigningLoading(true);
    try {
      const response = await getSigningProfile();
      if ((response.success || response.status) && response.data) {
        setSigningProfile(response.data);
      } else {
        showError(response?.message || response?.error || 'Failed to load signing profile');
      }
    } catch (error: any) {
      showError(error?.message || error?.error || 'Failed to load signing profile');
    } finally {
      if (!silent) setSigningLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (isOpen && activeTab === 'signature') loadSigningProfile();
  }, [isOpen, activeTab, loadSigningProfile]);

  const resetSignatureEditors = () => {
    setImageReplaceMode(false);
    setDrawingSignature(false);
    setDrawnSignature('');
    setPendingUpload('');
    setPendingPreview('');
    setTransparentBackground(true);
    setBackgroundThreshold(DEFAULT_BACKGROUND_THRESHOLD);
    setPadKey((k) => k + 1);
    setCertificateFile(null);
    setCertificatePassword('');
    setShowCertificatePassword(false);
  };

  useEffect(() => {
    if (!pendingUpload) return;
    if (!transparentBackground) {
      setPendingPreview(pendingUpload);
      return;
    }
    let cancelled = false;
    removeSignatureBackground(pendingUpload, backgroundThreshold)
      .then((result) => { if (!cancelled) setPendingPreview(result); })
      .catch((error: any) => {
        if (cancelled) return;
        showError(error?.message || 'Could not process the selected image');
        setPendingPreview(pendingUpload);
      });
    return () => { cancelled = true; };
  }, [pendingUpload, transparentBackground, backgroundThreshold, showError]);

  useEffect(() => {
    if (!isOpen) resetSignatureEditors();
  }, [isOpen]);

  const saveSignatureImage = async (dataUrl: string) => {
    if (!dataUrl) {
      showError('Draw or choose a signature first');
      return;
    }
    if (dataUrlByteSize(dataUrl) > MAX_SIGNATURE_IMAGE_BYTES) {
      showError('The signature image must be 200 KB or smaller');
      return;
    }
    setSavingSignature(true);
    try {
      const response = await uploadSignatureImage(dataUrl);
      if (response && (response.success || response.status)) {
        showSuccess(response.message || 'Signature image saved');
        setSigningProfile((prev) => ({
          ...(prev || {}),
          has_signature_image: true,
          signature_image: dataUrl,
        }));
        setImageReplaceMode(false);
        setDrawingSignature(false);
        setDrawnSignature('');
        setPendingUpload('');
        setPendingPreview('');
        setPadKey((k) => k + 1);
        loadSigningProfile(true);
      } else {
        showError(response?.message || response?.error || 'Failed to save signature image');
      }
    } catch (error: any) {
      showError(error?.message || error?.error || 'Failed to save signature image');
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png') {
      showError('The signature image must be a PNG file');
      return;
    }
    if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
      showError('The signature image must be 200 KB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTransparentBackground(true);
      setBackgroundThreshold(DEFAULT_BACKGROUND_THRESHOLD);
      setPendingUpload(String(reader.result || ''));
    };
    reader.onerror = () => showError('Could not read the selected image');
    reader.readAsDataURL(file);
  };

  const cancelPendingUpload = () => {
    setPendingUpload('');
    setPendingPreview('');
  };

  const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Phone file pickers report unreliable MIME types, so check the extension
    if (!/\.(p12|pfx)$/i.test(file.name)) {
      showError('Choose a certificate file ending in .p12 or .pfx');
      return;
    }
    if (file.size > MAX_CERTIFICATE_BYTES) {
      showError('The certificate file must be 64 KB or smaller');
      return;
    }
    setCertificateFile(file);
    setCertificatePassword('');
    setShowCertificatePassword(false);
    showWarning('Certificate selected. Enter its password to verify and save it.');
  };

  // Once a file is picked, put the cursor straight into the password field so verification is not forgotten
  useEffect(() => {
    if (certificateFile) certificatePasswordRef.current?.focus();
  }, [certificateFile]);

  const cancelPendingCertificate = () => {
    setCertificateFile(null);
    setCertificatePassword('');
    setShowCertificatePassword(false);
  };

  // An unverified certificate is lost when the panel goes away, so refuse to leave until it is verified or cancelled
  const hasUnverifiedCertificate = () => {
    if (!certificateFile || savingCertificate) return false;
    showWarning('Verify the certificate password first, or cancel the upload');
    certificatePasswordRef.current?.focus();
    return true;
  };

  const switchTab = (tab: typeof activeTab) => {
    if (hasUnverifiedCertificate()) return;
    setActiveTab(tab);
    if (tab !== 'notifications') setShowPasswordForm(false);
  };

  const handleClose = () => {
    if (hasUnverifiedCertificate()) return;
    onClose();
  };

  // The server opens the file with this password; a wrong password means nothing is stored
  const saveSigningCertificate = async () => {
    if (!certificateFile) {
      showError('Choose your certificate file first');
      return;
    }
    if (!certificatePassword) {
      showError('Enter the password for this certificate');
      return;
    }
    setSavingCertificate(true);
    try {
      const base64 = await fileToBase64(certificateFile);
      const response = await uploadSigningCertificate(base64, certificatePassword, certificateFile.name);
      if (response && (response.success || response.status)) {
        showSuccess(response.message || 'Digital certificate verified and saved');
        setSigningProfile((prev) => ({
          ...(prev || { has_signature_image: false, signature_image: null }),
          has_signing_certificate: true,
          signing_certificate: response.data?.signing_certificate || null,
        }));
        setCertificateFile(null);
        loadSigningProfile(true);
      } else {
        showError(response?.message || response?.error || 'The certificate was not saved');
      }
    } catch (error: any) {
      showError(error?.message || error?.error || 'The certificate was not saved');
    } finally {
      // Only needed for the check, so it must not linger
      setCertificatePassword('');
      setShowCertificatePassword(false);
      setSavingCertificate(false);
    }
  };

  const handleRemoveSigningCertificate = async () => {
    setRemovingCertificate(true);
    try {
      const response = await deleteSigningCertificate();
      if (response && (response.success || response.status)) {
        showSuccess(response.message || 'Digital certificate removed');
        setSigningProfile((prev) => ({
          ...(prev || { has_signature_image: false, signature_image: null }),
          has_signing_certificate: false,
          signing_certificate: null,
        }));
      } else {
        showError(response?.message || response?.error || 'Failed to remove the certificate');
      }
    } catch (error: any) {
      showError(error?.message || error?.error || 'Failed to remove the certificate');
    } finally {
      setRemovingCertificate(false);
    }
  };

  const handleRemoveSignatureImage = async () => {
    setRemovingSignature(true);
    try {
      const response = await deleteSignatureImage();
      if (response && (response.success || response.status)) {
        showSuccess(response.message || 'Signature image removed');
        setSigningProfile((prev) => ({
          ...(prev || {}),
          has_signature_image: false,
          signature_image: null,
        }));
        setImageReplaceMode(false);
      } else {
        showError(response?.message || response?.error || 'Failed to remove signature image');
      }
    } catch (error: any) {
      showError(error?.message || error?.error || 'Failed to remove signature image');
    } finally {
      setRemovingSignature(false);
    }
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('One special character');
    return errors;
  };

  const updatePasswordValidation = (password: string) => {
    const errors = validatePassword(password);
    setValidationErrors(errors.length > 0 ? errors : []);
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showError('All password fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New password and confirm password do not match');
      return;
    }

    if (passwordData.newPassword === passwordData.currentPassword) {
      showError('New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      if (response && (response.success || response.status)) {
        showSuccess('Password changed successfully');
        setShowPasswordForm(false);
        setIsChangingPassword(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordVisibility({ current: false, new: false, confirm: false });
        setValidationErrors([]);
      } else {
        showError(response?.message || response?.error || 'Failed to change password');
      }
    } catch (error: any) {
      showError(error?.message || error?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!isOpen) return null;

  const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };
  const busy = isChangingPassword || savingSignature || removingSignature || accountNotifLoading || notificationLoading;

  return (
    <OverlayShell
      title={
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700 font-semibold text-sm bg-gray-100 flex-shrink-0">
            {getInitials(displayName)}
          </span>
          <span>Profile</span>
        </span>
      }
      onClose={handleClose}
      busy={busy}
      width="lg"
      zIndex={10000}
      closeOnBackdrop={false}
      headerExtra={
        <div className="border-b" style={{ borderColor: BORDER }}>
          <nav className="flex overflow-x-auto">
            <button
              onClick={() => switchTab('profile')}
              className={`flex cursor-pointer items-center justify-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'text-[#056daa] border-b-2 border-[#056daa] bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              style={{ fontFamily: fontHeading }}
            >
              <FiUser className="w-5 h-5" />
              Profile
            </button>
             <button
               onClick={() => switchTab('security')}
               className={`flex cursor-pointer items-center justify-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                 activeTab === 'security'
                   ? 'text-[#056daa] border-b-2 border-[#056daa] bg-blue-50'
                   : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
               }`}
               style={{ fontFamily: fontHeading }}
             >
               <FiShield className="w-5 h-5" />
               Security
             </button>
             <button
               onClick={() => switchTab('notifications')}
               className={`flex cursor-pointer items-center justify-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                 activeTab === 'notifications'
                   ? 'text-[#056daa] border-b-2 border-[#056daa] bg-blue-50'
                   : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
               }`}
               style={{ fontFamily: fontHeading }}
             >
               <FiBell className="w-5 h-5" />
               Notifications
             </button>
             <button
               onClick={() => switchTab('signature')}
               className={`flex cursor-pointer items-center justify-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                 activeTab === 'signature'
                   ? 'text-[#056daa] border-b-2 border-[#056daa] bg-blue-50'
                   : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
               }`}
               style={{ fontFamily: fontHeading }}
             >
               <FiEdit3 className="w-5 h-5" />
               Signature
             </button>
          </nav>
        </div>
      }
    >
          {fetching ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-6 pb-4 border-b" style={{ borderColor: BORDER }}>
                     <div className="relative">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: getAvatarColor(displayName), borderRadius: '9999px' }}>
                      {getInitials(displayName)}
                       </div>
                     </div>
                     <div className="flex-1">
                      <h3 className="text-xl font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{displayName}</h3>
                      <p className="text-sm" style={{ color: "#555555" }}>{displayEmail || 'Not set'}</p>
                      {departmentName && (
                        <p className="text-xs cok-primary-color mt-1">{departmentName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 cok-bg-primary" style={{ backgroundColor: 'rgba(5,109,170,0.04)', borderRadius: 0 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <FiUser className="w-4 h-4" style={{ color: PRIMARY }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>Full Name</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{displayName}</p>
                    </div>

                    <div className="p-4" style={{ backgroundColor: 'rgba(5,109,170,0.04)', borderRadius: 0 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <FiMail className="w-4 h-4" style={{ color: PRIMARY }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>Email</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{displayEmail || 'Not set'}</p>
                    </div>

                    <div className="p-4" style={{ backgroundColor: 'rgba(5,109,170,0.04)', borderRadius: 0 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <FiPhone className="w-4 h-4" style={{ color: PRIMARY }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>Phone</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{profileData?.telephone || 'Not set'}</p>
                    </div>

                    <div className="p-4" style={{ backgroundColor: 'rgba(5,109,170,0.04)', borderRadius: 0 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <HiOutlineOfficeBuilding className="w-4 h-4" style={{ color: PRIMARY }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>Department</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{departmentName || 'Not assigned'}</p>
                    </div>

                    <div className="p-4" style={{ backgroundColor: 'rgba(5,109,170,0.04)', borderRadius: 0 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <FiBriefcase className="w-4 h-4" style={{ color: PRIMARY }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>Job Title</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{profileData?.title || 'Not set'}</p>
                    </div>

                    <div className="p-4" style={{ backgroundColor: 'rgba(5,109,170,0.04)', borderRadius: 0 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>Join Date</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{formatDate(profileData?.created_date)}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Security Settings</h3>

                  <div className="border" style={{ borderColor: BORDER, backgroundColor: 'rgba(5,109,170,0.02)', borderRadius: 0 }}>
                    <div
                      className="px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center cursor-pointer hover:bg-[rgba(5,109,170,0.04)]"
                      onClick={() => setShowPasswordForm(!showPasswordForm)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2" style={{ backgroundColor: 'rgba(231,76,60,0.12)' }}>
                          <FiLock className="w-5 h-5" style={{ color: "#E74C3C" }} />
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: NEUTRAL_DARK }}>Change Password</p>
                          <p className="text-xs" style={{ color: GRAY_DISABLED }}>Update your account password</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase transition-transform`} style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '1px' }}>
                          {showPasswordForm ? 'Hide' : 'Show'}
                        </span>
                      </div>
                    </div>

                    {showPasswordForm && (
                      <div className="p-4 sm:p-6 border-t" style={{ borderColor: BORDER }}>
                        <div className="mb-4">
                          <label className="block text-xs font-semibold uppercase mb-1 cok-req" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>
                            Current Password
                          </label>
                          <div className="relative">
                            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type={passwordVisibility.current ? "text" : "password"}
                              value={passwordData.currentPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                              className="w-full h-12 pl-10 pr-12 cok-auth-input text-base"
                              placeholder="Enter current password"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setPasswordVisibility(prev => ({ ...prev, current: !prev.current }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {passwordVisibility.current ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-xs font-semibold uppercase mb-1 cok-req" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>
                            New Password
                          </label>
                          <div className="relative">
                            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type={passwordVisibility.new ? "text" : "password"}
                              value={passwordData.newPassword}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPasswordData(prev => ({ ...prev, newPassword: value }));
                                if (value) {
                                  updatePasswordValidation(value);
                                } else {
                                  setValidationErrors([]);
                                }
                              }}
                              className="w-full h-12 pl-10 pr-12 cok-auth-input text-base"
                              placeholder="Enter new password (min 8 characters)"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setPasswordVisibility(prev => ({ ...prev, new: !prev.new }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {passwordVisibility.new ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                            </button>
                          </div>

                          {passwordData.newPassword && (
                            <div className="mt-2 space-y-1">
                              {[
                                { check: passwordData.newPassword.length >= 8, text: 'At least 8 characters' },
                                { check: /[A-Z]/.test(passwordData.newPassword), text: 'One uppercase letter' },
                                { check: /[a-z]/.test(passwordData.newPassword), text: 'One lowercase letter' },
                                { check: /[0-9]/.test(passwordData.newPassword), text: 'One number' },
                                { check: /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword), text: 'One special character' }
                              ].map((requirement, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  <div className={`w-2 h-2 ${requirement.check ? 'bg-green-500' : 'bg-gray-300'}`} style={{ borderRadius: 0 }}></div>
                                  <span className={requirement.check ? 'text-green-600' : 'text-gray-500'}>
                                    {requirement.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mb-4">
                          <label className="block text-xs font-semibold uppercase mb-1 cok-req" style={{ color: GRAY_DISABLED, fontFamily: fontHeading, letterSpacing: '0.5px' }}>
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type={passwordVisibility.confirm ? "text" : "password"}
                              value={passwordData.confirmPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="w-full h-12 pl-10 pr-12 cok-auth-input text-base"
                              placeholder="Confirm new password"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setPasswordVisibility(prev => ({ ...prev, confirm: !prev.confirm }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {passwordVisibility.confirm ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                            </button>
                          </div>

                          {passwordData.confirmPassword && passwordData.newPassword && (
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <div className={`w-2 h-2 ${
                                passwordData.newPassword === passwordData.confirmPassword ? 'bg-green-500' : 'bg-red-500'
                              }`} style={{ borderRadius: 0 }}></div>
                              <span className={
                                passwordData.newPassword === passwordData.confirmPassword ? 'text-green-600' : 'text-red-600'
                              }>
                                {passwordData.newPassword === passwordData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: BORDER }}>
                          <button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                            className="flex-1 h-12 cok-btn-primary flex items-center justify-center gap-2 text-base"
                            style={btnTypography}
                          >
                            {isChangingPassword ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Changing...</span>
                              </>
                            ) : (
                              <>
                                <FiLock className="w-5 h-5" />
                                <span>Change Password</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                     )}
                     </div>
 
                   </div>
                 )}
 
                 {activeTab === 'notifications' && (
                   <div className="space-y-4">
                     <h3 className="text-lg font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Notification Settings</h3>

                     <div className="border" style={{ borderColor: BORDER, backgroundColor: 'rgba(5,109,170,0.02)', borderRadius: 0 }}>
                       <div className="px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                           <div className="p-2" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                             <FiBell className="w-5 h-5" style={{ color: PRIMARY }} />
                           </div>
                           <div>
                             <p className="font-medium" style={{ color: NEUTRAL_DARK }}>Account Notifications</p>
                             <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                               {accountNotifEnabled
                                 ? 'You receive in-app notifications, including data waiting for your approval'
                                 : 'Notifications to this account are off - you will not be alerted about approval requests'}
                             </p>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className="text-xs font-semibold uppercase" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '1px' }}>
                             {accountNotifEnabled ? 'Enabled' : 'Disabled'}
                           </span>
                            <button
                              type="button"
                              onClick={handleToggleAccountNotifications}
                              disabled={accountNotifLoading}
                              className="relative cursor-pointer inline-flex h-6 w-11 items-center transition-colors"
                              style={{ borderRadius: 0 }}
                              aria-pressed={accountNotifEnabled}
                            >
                              {accountNotifLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : (
                                <>
                                  <span
                                    className="inline-block z-5 h-5 w-5 transition-transform duration-200"
                                    style={{
                                      transform: accountNotifEnabled ? 'translateX(20px)' : 'translateX(2px)',
                                      borderRadius: 990,
                                      backgroundColor: accountNotifEnabled ? PRIMARY : '#9E9E9E',
                                    }}
                                  />
                                  <span
                                    className="absolute inset-0 transition-colors duration-200"
                                    style={{
                                      borderRadius: 200,
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid #E0E0E0',
                                    }}
                                  />
                                </>
                              )}
                            </button>
                         </div>
                       </div>
                     </div>

                     <div className="border" style={{ borderColor: BORDER, backgroundColor: 'rgba(5,109,170,0.02)', borderRadius: 0 }}>
                       <div className="px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                           <div className="p-2" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                             <FiBell className="w-5 h-5" style={{ color: PRIMARY }} />
                           </div>
                           <div>
                             <p className="font-medium" style={{ color: NEUTRAL_DARK }}>Notifications</p>
                             <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                               {notificationSubscribed ? 'Receive notifications from IKAZE' : 'Enable notifications to stay updated'}
                             </p>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className="text-xs font-semibold uppercase" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '1px' }}>
                             {notificationSubscribed ? 'Enabled' : 'Disabled'}
                           </span>
                            <button
                              type="button"
                              onClick={handleToggleNotifications}
                              disabled={notificationLoading || notificationChecking}
                              className="relative cursor-pointer inline-flex h-6 w-11 items-center transition-colors"
                              style={{ borderRadius: 0 }}
                              aria-pressed={notificationSubscribed}
                            >
                              {notificationLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : (
                                <>
                                  <span
                                    className="inline-block z-5 h-5 w-5 transition-transform duration-200"
                                    style={{
                                      transform: notificationSubscribed ? 'translateX(20px)' : 'translateX(2px)',
                                      borderRadius: 990,
                                      backgroundColor: notificationSubscribed ? PRIMARY : '#9E9E9E',
                                    }}
                                  />
                                  <span
                                    className="absolute inset-0 transition-colors duration-200"
                                    style={{
                                      borderRadius: 200,
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid #E0E0E0',
                                    }}
                                  />
                                </>
                              )}
                            </button>
                         </div>
                       </div>
                     </div>
                   </div>
                 )}

                 {activeTab === 'signature' && (
                   <div className="space-y-4">
                     <h3 className="text-lg font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Signature Settings</h3>

                     {signingLoading ? (
                       <div className="flex items-center justify-center py-12">
                         <div className="w-8 h-8 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin" />
                       </div>
                     ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                         <div className="border flex flex-col" style={{ borderColor: BORDER, backgroundColor: 'rgba(5,109,170,0.02)', borderRadius: 0 }}>
                           <div className="px-3 py-2.5 min-h-[60px] flex justify-between items-center gap-2">
                             <div className="flex items-center gap-2.5 min-w-0">
                               <div className="p-1.5 shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                                 <FiEdit3 className="w-4 h-4" style={{ color: PRIMARY }} />
                               </div>
                               <div>
                                 <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>Signature image</p>
                                 <p className="text-xs" style={{ color: GRAY_DISABLED }}>Placed on the attendance sheets you sign.</p>
                               </div>
                             </div>
                             <span className="text-xs font-semibold uppercase whitespace-nowrap" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '1px' }}>
                               {signingProfile?.has_signature_image ? 'Saved' : 'Not set'}
                             </span>
                           </div>
                           <div className="p-3 border-t flex-1 flex flex-col" style={{ borderColor: BORDER }}>
                             <input
                               ref={signatureInputRef}
                               type="file"
                               accept="image/png"
                               className="hidden"
                               onChange={handleSignatureFileChange}
                             />
                             {signingProfile?.has_signature_image && signingProfile.signature_image && !imageReplaceMode ? (
                               <div className="flex-1 flex flex-col gap-3">
                                 <div className="bg-white h-28 flex items-center justify-center p-3" style={{ border: `1px solid ${BORDER}` }}>
                                   <img src={signingProfile.signature_image} alt="Your signature" className="max-h-full max-w-full object-contain" />
                                 </div>
                                 <p className="text-xs" style={{ color: GRAY_DISABLED }}>Shown next to your name on the sheets you sign.</p>
                                 <div className="flex gap-3 mt-auto">
                                   <button
                                     type="button"
                                     onClick={() => setImageReplaceMode(true)}
                                     className="flex-1 h-12 cok-btn-outlined"
                                     style={btnTypography}
                                   >
                                     Replace
                                   </button>
                                   <button
                                     type="button"
                                     onClick={handleRemoveSignatureImage}
                                     disabled={removingSignature}
                                     className="flex-1 h-12 cok-btn-outlined-danger disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     {removingSignature ? 'Removing...' : 'Remove'}
                                   </button>
                                 </div>
                               </div>
                             ) : pendingUpload ? (
                               <div className="flex-1 flex flex-col gap-3">
                                 <div
                                   className="h-28 flex items-center justify-center p-3"
                                   style={{
                                     border: `1px solid ${BORDER}`,
                                     backgroundColor: WHITE,
                                     backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                                     backgroundSize: '16px 16px',
                                     backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                                   }}
                                 >
                                   {pendingPreview ? (
                                     <img src={pendingPreview} alt="Signature preview" className="max-h-full max-w-full object-contain" />
                                   ) : (
                                     <div className="w-6 h-6 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin" />
                                   )}
                                 </div>
                                 <label className="flex items-center justify-between gap-3 cursor-pointer">
                                   <span className="text-sm" style={{ color: NEUTRAL_DARK }}>Make the background transparent</span>
                                   <input
                                     type="checkbox"
                                     checked={transparentBackground}
                                     onChange={(e) => setTransparentBackground(e.target.checked)}
                                     className="w-4 h-4"
                                     style={{ accentColor: PRIMARY }}
                                   />
                                 </label>
                                 {transparentBackground && (
                                   <div className="space-y-1">
                                     <div className="flex justify-between text-xs" style={{ color: GRAY_DISABLED }}>
                                       <span>Keep more ink</span>
                                       <span>Remove more background</span>
                                     </div>
                                     <input
                                       type="range"
                                       min={120}
                                       max={250}
                                       step={5}
                                       value={backgroundThreshold}
                                       onChange={(e) => setBackgroundThreshold(Number(e.target.value))}
                                       className="w-full"
                                       style={{ accentColor: PRIMARY }}
                                     />
                                   </div>
                                 )}
                                 <div className="flex gap-3 mt-auto">
                                   <button
                                     type="button"
                                     onClick={cancelPendingUpload}
                                     disabled={savingSignature}
                                     className="flex-1 h-12 cok-btn-outlined disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     Back
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => saveSignatureImage(pendingPreview)}
                                     disabled={savingSignature || !pendingPreview}
                                     className="flex-1 h-12 cok-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     {savingSignature ? (
                                       <>
                                         <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                         <span>Saving...</span>
                                       </>
                                     ) : (
                                       <span>Save signature</span>
                                     )}
                                   </button>
                                 </div>
                               </div>
                             ) : drawingSignature ? (
                               <div className="flex-1 flex flex-col gap-3">
                                 <SignaturePad key={`profile-pad-${padKey}`} onChange={(value: string) => setDrawnSignature(value)} />
                                 <div className="flex gap-3 mt-auto">
                                   <button
                                     type="button"
                                     onClick={() => { setDrawingSignature(false); setDrawnSignature(''); setPadKey((k) => k + 1); }}
                                     className="flex-1 h-12 cok-btn-outlined"
                                     style={btnTypography}
                                   >
                                     Back
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => saveSignatureImage(drawnSignature)}
                                     disabled={savingSignature || !drawnSignature}
                                     className="flex-1 h-12 cok-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     {savingSignature ? (
                                       <>
                                         <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                         <span>Saving...</span>
                                       </>
                                     ) : (
                                       <span>Save signature</span>
                                     )}
                                   </button>
                                 </div>
                               </div>
                             ) : (
                               <div className="flex-1 flex flex-col gap-3">
                                 <div
                                   onClick={() => !savingSignature && signatureInputRef.current?.click()}
                                   className="cursor-pointer h-12 flex items-center justify-center gap-2 px-3 transition-colors hover:bg-[#E3F2FD]"
                                   style={{ border: '2px dashed #9CC7E4', backgroundColor: NEUTRAL_LIGHT }}
                                 >
                                   {savingSignature ? (
                                     <div className="w-4 h-4 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin" />
                                   ) : (
                                     <FiUploadCloud className="w-4 h-4 shrink-0" style={{ color: PRIMARY }} />
                                   )}
                                   <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                                     {savingSignature ? 'Saving...' : 'Upload PNG signature'}
                                   </span>
                                 </div>
                                 <p className="text-xs" style={{ color: GRAY_DISABLED }}>PNG, up to 200 KB. A light background is removed before saving.</p>
                                 <div className="flex gap-3 mt-auto">
                                   {imageReplaceMode && (
                                     <button
                                       type="button"
                                       onClick={() => setImageReplaceMode(false)}
                                       className="flex-1 h-12 cok-btn-outlined"
                                       style={btnTypography}
                                     >
                                       Back
                                     </button>
                                   )}
                                   <button
                                     type="button"
                                     onClick={() => setDrawingSignature(true)}
                                     disabled={savingSignature}
                                     className="flex-1 h-12 cok-btn-outlined flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     <FiEdit3 className="w-4 h-4" />
                                     <span>Draw instead</span>
                                   </button>
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>

                         {/* Card 2: digital certificate kept on the profile so attendance can be signed without picking the file again */}
                         <div className="border flex flex-col" style={{ borderColor: BORDER, backgroundColor: 'rgba(5,109,170,0.02)', borderRadius: 0 }}>
                           <div className="px-3 py-2.5 min-h-[60px] flex justify-between items-center gap-2">
                             <div className="flex items-center gap-2.5 min-w-0">
                               <div className="p-1.5 shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                                 <FiShield className="w-4 h-4" style={{ color: PRIMARY }} />
                               </div>
                               <div>
                                 <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>Digital certificate</p>
                                 <p className="text-xs" style={{ color: GRAY_DISABLED }}>Sign attendance without re-uploading the file.</p>
                               </div>
                             </div>
                             <span className="text-xs font-semibold uppercase whitespace-nowrap" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '1px' }}>
                               {signingProfile?.has_signing_certificate ? 'Saved' : 'Not set'}
                             </span>
                           </div>
                           <div className="p-3 border-t flex-1 flex flex-col" style={{ borderColor: BORDER }}>
                             <input
                               ref={certificateInputRef}
                               type="file"
                               accept=".p12,.pfx"
                               className="hidden"
                               onChange={handleCertificateFileChange}
                             />
                             {signingProfile?.has_signing_certificate && signingProfile.signing_certificate && !certificateFile ? (
                               <div className="flex-1 flex flex-col gap-3">
                                 <div className="bg-white h-28 p-3 flex flex-col justify-center gap-0.5" style={{ border: `1px solid ${BORDER}` }}>
                                   <p className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                                     {signingProfile.signing_certificate.subject_common_name || 'Unknown signer'}
                                   </p>
                                   <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                                     Issued by {signingProfile.signing_certificate.issuer_common_name || 'an unknown issuer'}
                                   </p>
                                   <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                                     Valid until {formatCertificateDate(signingProfile.signing_certificate.valid_to)}
                                   </p>
                                   {signingProfile.signing_certificate.file_name && (
                                     <p className="text-xs truncate" style={{ color: GRAY_DISABLED }}>File: {signingProfile.signing_certificate.file_name}</p>
                                   )}
                                 </div>
                                 <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                                   The password is not stored. You type it each time you sign.
                                 </p>
                                 <div className="flex gap-3 mt-auto">
                                   <button
                                     type="button"
                                     onClick={() => !savingCertificate && certificateInputRef.current?.click()}
                                     disabled={savingCertificate || removingCertificate}
                                     className="flex-1 h-12 cok-btn-outlined disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     Replace
                                   </button>
                                   <button
                                     type="button"
                                     onClick={handleRemoveSigningCertificate}
                                     disabled={removingCertificate}
                                     className="flex-1 h-12 cok-btn-outlined-danger disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     {removingCertificate ? 'Removing...' : 'Remove'}
                                   </button>
                                 </div>
                               </div>
                             ) : certificateFile ? (
                               <div className="flex-1 flex flex-col gap-3">
                                 <div className="flex items-center gap-3 px-3 py-2.5 bg-white" style={{ border: `1px solid ${BORDER}` }}>
                                   <div className="p-2 shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.08)' }}>
                                     <FiShield className="w-4 h-4" style={{ color: PRIMARY }} />
                                   </div>
                                   <div className="min-w-0 flex-1">
                                     <p className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{certificateFile.name}</p>
                                     <p className="text-xs" style={{ color: GRAY_DISABLED }}>{(certificateFile.size / 1024).toFixed(1)} KB</p>
                                   </div>
                                   <button
                                     type="button"
                                     title="Remove file"
                                     onClick={cancelPendingCertificate}
                                     disabled={savingCertificate}
                                     className="p-1.5 shrink-0 cursor-pointer transition-colors hover:bg-[#FDECEA] disabled:opacity-60"
                                     style={{ color: '#E74C3C' }}
                                   >
                                     <FiX className="w-4 h-4" />
                                   </button>
                                 </div>
                                 <div className="flex items-start gap-2 px-3 py-2 text-xs" style={{ backgroundColor: '#FFF8E1', border: '1px solid #F5C451', color: '#8A6D1D' }}>
                                   <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                   <span>Not saved yet. Enter the certificate password below and press Verify and save.</span>
                                 </div>
                                 <div>
                                   <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, letterSpacing: '0.5px' }}>
                                     Certificate password <span style={{ color: '#E74C3C' }}>*</span>
                                   </label>
                                   <div className="relative">
                                     <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                                     <input
                                       ref={certificatePasswordRef}
                                       type={showCertificatePassword ? 'text' : 'password'}
                                       value={certificatePassword}
                                       autoComplete="off"
                                       autoFocus
                                       required
                                       placeholder="Password for this certificate"
                                       onChange={(e) => setCertificatePassword(e.target.value)}
                                       onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSigningCertificate(); } }}
                                       disabled={savingCertificate}
                                       className="w-full cok-auth-input py-2 text-sm"
                                       style={{ paddingLeft: '36px', paddingRight: '40px' }}
                                     />
                                     <button
                                       type="button"
                                       onClick={() => setShowCertificatePassword((v) => !v)}
                                       className="absolute right-3 top-1/2 -translate-y-1/2"
                                       style={{ color: GRAY_DISABLED }}
                                       tabIndex={-1}
                                     >
                                       {showCertificatePassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                     </button>
                                   </div>
                                   <p className="text-xs mt-1.5" style={{ color: GRAY_DISABLED }}>
                                     Checked once to open the file. If wrong, nothing is saved. It is never stored.
                                   </p>
                                 </div>
                                 <div className="flex gap-3 mt-auto">
                                   <button
                                     type="button"
                                     onClick={cancelPendingCertificate}
                                     disabled={savingCertificate}
                                     className="flex-1 h-12 cok-btn-outlined disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     Cancel
                                   </button>
                                   <button
                                     type="button"
                                     onClick={saveSigningCertificate}
                                     disabled={savingCertificate || !certificatePassword}
                                     className="flex-1 h-12 cok-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                     style={btnTypography}
                                   >
                                     {savingCertificate ? (
                                       <>
                                         <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                         <span>Verifying...</span>
                                       </>
                                     ) : (
                                       <span>Verify and save</span>
                                     )}
                                   </button>
                                 </div>
                               </div>
                             ) : (
                               <div className="flex-1 flex flex-col gap-3">
                                 <div
                                   onClick={() => !savingCertificate && certificateInputRef.current?.click()}
                                   className="cursor-pointer h-12 flex items-center justify-center gap-2 px-3 transition-colors hover:bg-[#E3F2FD]"
                                   style={{ border: '2px dashed #9CC7E4', backgroundColor: NEUTRAL_LIGHT }}
                                 >
                                   <FiUploadCloud className="w-4 h-4 shrink-0" style={{ color: PRIMARY }} />
                                   <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                                     Upload .p12 / .pfx certificate
                                   </span>
                                 </div>
                                 <p className="text-xs" style={{ color: GRAY_DISABLED }}>Up to 64 KB. Its password is checked once before saving and is never stored.</p>
                               </div>
                             )}
                           </div>
                         </div>

                       </div>
                     )}
                   </div>
                 )}
               </>
             )}
    </OverlayShell>
  );
};

export default ProfileModal;
