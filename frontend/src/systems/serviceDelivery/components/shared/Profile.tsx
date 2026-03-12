// Profile Component - User profile with image upload
import React, { useState, useRef } from 'react';
import { FiCamera, FiUpload, FiX, FiUser } from 'react-icons/fi';

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
      <div className="bg-white rounded-[16px] w-[400px] max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a2744] to-[#2c3e50] p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-white text-[20px] font-bold">Profile</h2>
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
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#1a73e8]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-[#e0e0e0]">
                  <FiUser className="w-10 h-10 text-gray-400" />
                </div>
              )}
              
              {/* Edit Button */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="absolute bottom-0 right-0 w-8 h-8 bg-[#1a73e8] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#1558c0]"
              >
                <FiCamera className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Options */}
            {isEditing && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={openCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-[12px] rounded-[8px] hover:bg-[#1558c0]"
                >
                  <FiCamera className="w-4 h-4" />
                  Camera
                </button>
                <button
                  onClick={handleGalleryClick}
                  className="flex items-center gap-2 px-4 py-2 bg-[#34a853] text-white text-[12px] rounded-[8px] hover:bg-[#2d8e47]"
                >
                  <FiUpload className="w-4 h-4" />
                  Gallery
                </button>
                {avatarPreview && (
                  <button
                    onClick={handleRemovePhoto}
                    className="flex items-center gap-2 px-4 py-2 bg-[#e53935] text-white text-[12px] rounded-[8px] hover:bg-[#c62828]"
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
                className="w-full rounded-[8px] bg-black"
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-2 bg-[#1a73e8] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#1558c0]"
                >
                  Capture Photo
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 bg-gray-500 text-white text-[13px] font-medium rounded-[8px] hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <label className="text-[#999] text-[11px] uppercase tracking-wider">Full Name</label>
              <div className="text-[#1a2744] text-[16px] font-medium mt-1">
                {user.firstName} {user.lastName}
              </div>
            </div>
            
            <div>
              <label className="text-[#999] text-[11px] uppercase tracking-wider">Role</label>
              <div className="text-[#666] text-[14px] mt-1">
                {user.role}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 h-11 bg-[#1a73e8] text-white text-[14px] font-medium rounded-[8px] hover:bg-[#1558c0]"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
