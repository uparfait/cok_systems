// Profile Component - User profile with image upload
import React, { useState, useRef } from 'react';
import { FiCamera, FiUpload, FiX, FiUser } from 'react-icons/fi';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: TERTIARY,
};

const buttonTypeStyle: React.CSSProperties = {
  borderRadius: 0,
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
};

interface UserProfile {
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string | null;
}

interface ProfileProps {
  user: UserProfile;
  onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onClose }) => {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar || null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const getInitials = (firstName: string, lastName: string) => {
    return (firstName[0] + lastName[0]).toUpperCase();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setIsEditing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setAvatarPreview(dataUrl);
        stopCamera();
        setIsEditing(false);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="w-[400px] max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}
      >
        {/* Header */}
        <div className="p-6" style={{ backgroundColor: PRIMARY }}>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-white text-[20px] font-bold" style={{ fontFamily: fontHeading }}>Profile</h2>
              <p className="text-white/70 text-[12px] mt-1">View and edit your profile</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#056daa]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#F7F9FB] flex items-center justify-center border-4 border-[#E0E0E0]">
                  <FiUser className="w-10 h-10 text-[#9E9E9E]" />
                </div>
              )}

              {/* Edit Button */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="absolute bottom-0 right-0 w-8 h-8 bg-[#056daa] rounded-full flex items-center justify-center text-white hover:bg-[#045d94] transition-colors"
              >
                <FiCamera className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Options */}
            {isEditing && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={openCamera}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] uppercase transition-colors"
                  style={{ ...buttonTypeStyle, backgroundColor: PRIMARY, color: WHITE }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  <FiCamera className="w-4 h-4" />
                  Camera
                </button>
                <button
                  onClick={handleGalleryClick}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] uppercase transition-colors"
                  style={{ ...buttonTypeStyle, backgroundColor: SUCCESS, color: WHITE }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
                >
                  <FiUpload className="w-4 h-4" />
                  Gallery
                </button>
                {avatarPreview && (
                  <button
                    onClick={handleRemovePhoto}
                    className="flex items-center gap-2 px-4 py-2 text-[12px] uppercase transition-colors"
                    style={{ ...buttonTypeStyle, backgroundColor: DANGER, color: WHITE }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Camera View */}
          {showCamera && (
            <div className="mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full bg-black"
                style={{ borderRadius: 0 }}
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-2 text-[13px] uppercase transition-colors"
                  style={{ ...buttonTypeStyle, backgroundColor: PRIMARY, color: WHITE }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  Capture Photo
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 text-[13px] uppercase hover:bg-[rgba(5,109,170,0.08)] transition-colors"
                  style={{ ...buttonTypeStyle, backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <label className="uppercase" style={labelStyle}>Full Name</label>
              <div className="text-[16px] font-medium mt-1" style={{ color: NEUTRAL_DARK }}>
                {user.firstName} {user.lastName}
              </div>
            </div>

            <div>
              <label className="uppercase" style={labelStyle}>Role</label>
              <div className="text-[#555555] text-[14px] mt-1">
                {user.role}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 h-11 uppercase transition-colors"
            style={{ ...buttonTypeStyle, backgroundColor: PRIMARY, color: WHITE }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
