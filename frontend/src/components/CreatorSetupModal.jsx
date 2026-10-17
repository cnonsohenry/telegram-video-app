import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  ShieldCheck,
  Mail,
  FileCheck,
  Camera,
  Upload,
  Loader2,
  Lock
} from "lucide-react";
import { APP_CONFIG } from "../config";
import useModalHistory from "../hooks/useModalHistory";

const BANNER_PRESETS = [
  { label: "Luxury Noir", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80" },
  { label: "Neon Glow", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&q=80" },
  { label: "Sunset Gold", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80" },
  { label: "Cyber Velvet", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80" }
];

const CATEGORIES = [
  "Model & Glamour",
  "Fitness & Wellness",
  "Baddies & Lifestyle",
  "VIP Exclusive",
  "Cosplay & Fantasy",
  "Art & Music"
];

const ID_TYPES = [
  { value: "national_id", label: "National ID / NIN Slip" },
  { value: "passport", label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card", label: "Permanent Voter's Card (PVC)" }
];

export default function CreatorSetupModal({ user, onClose, onSetupSuccess }) {
  const handleSafeClose = useModalHistory(true, onClose, "creatorSetup");

  // Verification State
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.email_verified));
  const [kycStatus, setKycStatus] = useState(user?.kyc_status || (user?.is_verified ? "verified" : "unverified"));
  const [step, setStep] = useState(() => {
    if (!user?.email_verified) return 1;
    if (user?.kyc_status !== "verified" && !user?.is_verified) return 2;
    return 3;
  });

  // Step 1: Email OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 2: Identity KYC State
  const [fullName, setFullName] = useState(user?.display_name || "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [documentType, setDocumentType] = useState("national_id");
  const [documentNumber, setDocumentNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState("");
  const [idBackUrl, setIdBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [uploadingField, setUploadingField] = useState(null);
  const [kycSubmitting, setKycSubmitting] = useState(false);

  // Step 3: Creator Profile & Monetization State
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || "");
  const [category, setCategory] = useState(user?.creator_category || "Model & Glamour");
  const [bio, setBio] = useState(
    user?.creator_bio ||
      "Welcome to my official VIP hub. Subscribe for daily exclusive drops and behind-the-scenes content."
  );
  const [subscriptionPrice, setSubscriptionPrice] = useState(
    user?.subscription_price ? String(user.subscription_price) : "15"
  );
  const [bannerUrl, setBannerUrl] = useState(user?.banner_url || BANNER_PRESETS[0].url);
  const [customBanner, setCustomBanner] = useState("");
  const [location, setLocation] = useState(user?.location || "Lagos, Nigeria");
  const [website, setWebsite] = useState(user?.website || "");
  const [twitter, setTwitter] = useState(user?.social_links?.twitter || "");
  const [instagram, setInstagram] = useState(user?.social_links?.instagram || "");
  const [telegram, setTelegram] = useState(user?.social_links?.telegram || "");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sync latest KYC & Email verification status from backend
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${APP_CONFIG.apiUrl}/api/creator/kyc/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const ev = Boolean(data.email_verified);
        const ks = data.kyc_status || (data.is_verified ? "verified" : "unverified");
        setEmailVerified(ev);
        setKycStatus(ks);

        if (data.request) {
          if (data.request.full_name) setFullName(data.request.full_name);
          if (data.request.country) setCountry(data.request.country);
          if (data.request.document_type) setDocumentType(data.request.document_type);
        }

        if (!ev) {
          setStep(1);
        } else if (ks !== "verified") {
          setStep(2);
        } else {
          setStep(3);
        }
      })
      .catch(() => {});
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Step 1 Handlers: Send & Verify Email OTP
  const handleSendOtp = async () => {
    setError("");
    setSuccessMsg("");
    setOtpLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/send-email-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send verification code");

      if (data.already_verified) {
        setEmailVerified(true);
        setStep(kycStatus === "verified" ? 3 : 2);
        return;
      }

      setOtpSent(true);
      setResendCooldown(60);
      setSuccessMsg(data.message || `6-digit code sent to ${user?.email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setOtpLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/verify-email-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid verification code");

      setEmailVerified(true);
      setSuccessMsg("Email verified! Proceeding to Identity KYC verification...");
      if (data.user && onSetupSuccess) {
        onSetupSuccess(data.user);
      }
      setTimeout(() => {
        setSuccessMsg("");
        setStep(kycStatus === "verified" ? 3 : 2);
      }, 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // Image Upload Helper for KYC & Banner
  const handleFileUpload = async (file, folder, targetField) => {
    if (!file) return;
    setError("");
    setUploadingField(targetField);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("image", file);
      formData.append("folder", folder);

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image upload failed");

      if (targetField === "id_front") setIdFrontUrl(data.url);
      if (targetField === "id_back") setIdBackUrl(data.url);
      if (targetField === "selfie") setSelfieUrl(data.url);
      if (targetField === "banner") {
        setBannerUrl(data.url);
        setCustomBanner(data.url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingField(null);
    }
  };

  // Step 2 Handler: Submit Identity KYC
  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (fullName.trim().length < 3) {
      setError("Please enter your full legal name as shown on your government ID.");
      return;
    }
    if (!dateOfBirth) {
      setError("Please select your date of birth (must be 18+).");
      return;
    }
    if (documentNumber.trim().length < 4) {
      setError("Please enter a valid government ID document number.");
      return;
    }
    if (!idFrontUrl) {
      setError("Please upload a clear photo of the front of your government ID.");
      return;
    }
    if (!selfieUrl) {
      setError("Please upload a verification selfie photo.");
      return;
    }

    setKycSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/kyc/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth,
          country: country.trim(),
          document_type: documentType,
          document_number: documentNumber.trim(),
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl || null,
          selfie_url: selfieUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Identity KYC verification failed");

      setKycStatus("verified");
      setSuccessMsg("Identity KYC verified! Now configure your Creator subscription pricing.");
      if (data.user && onSetupSuccess) {
        onSetupSuccess(data.user);
      }
      setTimeout(() => {
        setSuccessMsg("");
        setStep(3);
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setKycSubmitting(false);
    }
  };

  // Step 3 Handler: Final Creator Upgrade & Monetization Setup
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter your Creator Display Name.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please log in first");

      const finalBanner = customBanner.trim() ? customBanner.trim() : bannerUrl;

      const payload = {
        display_name: displayName.trim(),
        creator_category: category,
        creator_bio: bio.trim(),
        subscription_price: Number(subscriptionPrice) || 0,
        banner_url: finalBanner,
        location: location.trim(),
        website: website.trim(),
        social_links: {
          twitter: twitter.trim(),
          instagram: instagram.trim(),
          telegram: telegram.trim()
        }
      };

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requires_email_verification) {
          setStep(1);
        } else if (data.requires_kyc) {
          setStep(2);
        }
        throw new Error(data.error || "Failed to upgrade to creator");
      }

      if (onSetupSuccess) {
        onSetupSuccess(data.user);
      }
      handleSafeClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={fullscreenContainerStyle}>
      {/* Top Navigation Bar */}
      <div style={topNavStyle}>
        <button onClick={handleSafeClose} style={navBackBtnStyle} aria-label="Back">
          <ArrowLeft size={22} color="#f4f4f5" />
        </button>

        <span style={topNavTitleStyle}>Creator Verification & Monetization</span>

        <div style={{ width: "34px" }} />
      </div>

      {/* 3-Step Progress Header */}
      <div style={stepperContainerStyle}>
        <div style={stepperInnerStyle}>
          <div
            onClick={() => setStep(1)}
            style={{
              ...stepPillStyle,
              background: step === 1 ? "#27272a" : "transparent",
              borderColor: emailVerified ? "rgba(225, 29, 72, 0.4)" : step === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
              color: emailVerified ? "#f43f5e" : step === 1 ? "#f4f4f5" : "#71717a"
            }}
          >
            {emailVerified ? <CheckCircle size={14} color="#f43f5e" /> : <Mail size={14} />}
            <span>1. Email</span>
          </div>

          <div style={stepConnectorStyle} />

          <div
            onClick={() => {
              if (emailVerified) setStep(2);
            }}
            style={{
              ...stepPillStyle,
              cursor: emailVerified ? "pointer" : "not-allowed",
              background: step === 2 ? "#27272a" : "transparent",
              borderColor: kycStatus === "verified" ? "rgba(225, 29, 72, 0.4)" : step === 2 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
              color: kycStatus === "verified" ? "#f43f5e" : step === 2 ? "#f4f4f5" : "#71717a"
            }}
          >
            {kycStatus === "verified" ? <CheckCircle size={14} color="#f43f5e" /> : <FileCheck size={14} />}
            <span>2. Identity KYC</span>
          </div>

          <div style={stepConnectorStyle} />

          <div
            onClick={() => {
              if (emailVerified && kycStatus === "verified") setStep(3);
            }}
            style={{
              ...stepPillStyle,
              cursor: emailVerified && kycStatus === "verified" ? "pointer" : "not-allowed",
              background: step === 3 ? "#27272a" : "transparent",
              borderColor: step === 3 ? "rgba(225, 29, 72, 0.5)" : "rgba(255,255,255,0.08)",
              color: step === 3 ? "#f43f5e" : "#71717a"
            }}
          >
            <Sparkles size={14} />
            <span>3. Monetize</span>
          </div>
        </div>
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerContentStyle}>
          {error && (
            <div style={errorBannerStyle}>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={successBannerStyle}>
              <CheckCircle size={16} color="#f43f5e" style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* =====================================================
              STEP 1: EMAIL VERIFICATION
          ===================================================== */}
          {step === 1 && (
            <div style={stepCardStyle}>
              <div style={stepIconCircleStyle}>
                <Mail size={24} color="#f43f5e" />
              </div>
              <h3 style={stepHeadingStyle}>Verify Your Email Address</h3>
              <p style={stepDescStyle}>
                To protect creator payouts and account security, please verify the email address linked to your account before unlocking Creator monetization.
              </p>

              <div style={emailBadgeBoxStyle}>
                <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Registered Email</span>
                <strong style={{ fontSize: "14px", color: "#f4f4f5" }}>{user?.email || "No email on file"}</strong>
              </div>

              {emailVerified ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
                  <div style={verifiedNoticeStyle}>
                    <CheckCircle size={18} color="#f43f5e" />
                    <span>Your email address is verified!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(kycStatus === "verified" ? 3 : 2)}
                    style={primaryActionBtnStyle}
                  >
                    Continue to Identity KYC →
                  </button>
                </div>
              ) : !otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  style={primaryActionBtnStyle}
                >
                  {otpLoading ? (
                    <span style={flexCenterGapStyle}>
                      <Loader2 size={17} className="animate-spin" /> Sending Verification Code...
                    </span>
                  ) : (
                    "Send 6-Digit Verification Code"
                  )}
                </button>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%" }}>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Enter 6-Digit Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      style={{
                        ...inputStyle,
                        textAlign: "center",
                        fontSize: "22px",
                        fontWeight: "800",
                        letterSpacing: "8px"
                      }}
                    />
                  </div>

                  <button type="submit" disabled={otpLoading || otpCode.length < 6} style={primaryActionBtnStyle}>
                    {otpLoading ? (
                      <span style={flexCenterGapStyle}>
                        <Loader2 size={17} className="animate-spin" /> Verifying...
                      </span>
                    ) : (
                      "Verify Code & Continue"
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={handleSendOtp}
                    style={secondaryGhostBtnStyle}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Verification Code"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* =====================================================
              STEP 2: IDENTITY KYC VERIFICATION
          ===================================================== */}
          {step === 2 && (
            <form onSubmit={handleKycSubmit} style={stepCardStyle}>
              <div style={stepIconCircleStyle}>
                <ShieldCheck size={24} color="#f43f5e" />
              </div>
              <h3 style={stepHeadingStyle}>Identity KYC Verification (18+)</h3>
              <p style={stepDescStyle}>
                Creators who set subscription prices and monetize content must verify their legal identity and age (18+). Your documents are encrypted and strictly used for compliance verification.
              </p>

              {kycStatus === "verified" ? (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={verifiedNoticeStyle}>
                    <CheckCircle size={18} color="#f43f5e" />
                    <span>Identity KYC Verified! You are approved for Creator monetization.</span>
                  </div>
                  <button type="button" onClick={() => setStep(3)} style={primaryActionBtnStyle}>
                    Proceed to Creator Pricing & Setup →
                  </button>
                </div>
              ) : (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Full Legal Name (As shown on ID) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chidinma Adebayo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Date of Birth (18+) *</label>
                      <input
                        type="date"
                        required
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Country *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nigeria"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Government ID Type *</label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      style={inputStyle}
                    >
                      {ID_TYPES.map((t) => (
                        <option key={t.value} value={t.value} style={{ background: "#18181b", color: "#f4f4f5" }}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>ID / Document Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your ID number"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  {/* Document Photo Uploads */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {/* ID Front */}
                    <div style={uploadBoxStyle}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#e4e4e7" }}>Front of ID *</span>
                      {idFrontUrl ? (
                        <div style={previewThumbWrapStyle}>
                          <img src={idFrontUrl} alt="ID Front" style={previewThumbImgStyle} />
                          <span style={uploadedBadgeStyle}>✓ Uploaded</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#71717a" }}>Clear photo of ID front</span>
                      )}
                      <label style={uploadTriggerBtnStyle}>
                        {uploadingField === "id_front" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Upload size={14} />
                        )}
                        <span>{idFrontUrl ? "Change Photo" : "Upload Front"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: "none" }}
                          onChange={(e) => handleFileUpload(e.target.files?.[0], "kyc", "id_front")}
                        />
                      </label>
                    </div>

                    {/* ID Back (Optional) */}
                    <div style={uploadBoxStyle}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#e4e4e7" }}>Back of ID (Optional)</span>
                      {idBackUrl ? (
                        <div style={previewThumbWrapStyle}>
                          <img src={idBackUrl} alt="ID Back" style={previewThumbImgStyle} />
                          <span style={uploadedBadgeStyle}>✓ Uploaded</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#71717a" }}>Back side if applicable</span>
                      )}
                      <label style={uploadTriggerBtnStyle}>
                        {uploadingField === "id_back" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Upload size={14} />
                        )}
                        <span>{idBackUrl ? "Change Photo" : "Upload Back"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: "none" }}
                          onChange={(e) => handleFileUpload(e.target.files?.[0], "kyc", "id_back")}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Live Selfie Verification */}
                  <div style={uploadBoxStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Camera size={15} color="#f43f5e" />
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#f4f4f5" }}>
                        Verification Selfie Photo *
                      </span>
                    </div>
                    {selfieUrl ? (
                      <div style={{ ...previewThumbWrapStyle, height: "110px" }}>
                        <img src={selfieUrl} alt="Selfie" style={previewThumbImgStyle} />
                        <span style={uploadedBadgeStyle}>✓ Selfie Uploaded</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                        Take or upload a clear photo of your face matching your government ID.
                      </span>
                    )}
                    <label style={uploadTriggerBtnStyle}>
                      {uploadingField === "selfie" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Camera size={14} />
                      )}
                      <span>{selfieUrl ? "Retake / Change Selfie" : "Take or Upload Selfie"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="user"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(e.target.files?.[0], "kyc", "selfie")}
                      />
                    </label>
                  </div>

                  <div style={privacyNoteBoxStyle}>
                    <Lock size={14} color="#a1a1aa" style={{ flexShrink: 0 }} />
                    <span>
                      Your KYC documents are kept strictly private and are never displayed publicly on your profile.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={kycSubmitting || Boolean(uploadingField)}
                    style={primaryActionBtnStyle}
                  >
                    {kycSubmitting ? (
                      <span style={flexCenterGapStyle}>
                        <Loader2 size={17} className="animate-spin" /> Verifying Identity KYC...
                      </span>
                    ) : (
                      "Verify Identity & Unlock Monetization"
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* =====================================================
              STEP 3: CREATOR MONETIZATION & PROFILE SETUP
          ===================================================== */}
          {step === 3 && (
            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={verifiedNoticeStyle}>
                <CheckCircle size={17} color="#f43f5e" style={{ flexShrink: 0 }} />
                <span>Email & Identity KYC Verified — Creator Monetization Unlocked</span>
              </div>

              {/* Banner Selector + Direct Upload */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Profile Cover Banner</label>
                <div
                  style={{
                    ...bannerPreviewStyle,
                    backgroundImage: `url(${customBanner.trim() || bannerUrl})`
                  }}
                >
                  <label style={bannerUploadOverlayBtnStyle}>
                    {uploadingField === "banner" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Camera size={13} />
                    )}
                    <span>{uploadingField === "banner" ? "Uploading..." : "Upload Custom Cover"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(e.target.files?.[0], "banners", "banner")}
                    />
                  </label>
                </div>
                <div style={presetRowStyle}>
                  {BANNER_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => {
                        setBannerUrl(preset.url);
                        setCustomBanner("");
                      }}
                      style={{
                        ...presetBtnStyle,
                        borderColor:
                          bannerUrl === preset.url && !customBanner ? "#e11d48" : "rgba(255,255,255,0.08)"
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Creator / Stage Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Queen Bella"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Category */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Primary Category / Niche</label>
                <div style={categoryChipsContainer}>
                  {CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setCategory(cat)}
                      style={{
                        ...chipStyle,
                        background: category === cat ? "#e11d48" : "#27272a",
                        color: category === cat ? "#f4f4f5" : "#a1a1aa",
                        borderColor: category === cat ? "#e11d48" : "rgba(255,255,255,0.08)"
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Creator Bio</label>
                <textarea
                  rows={3}
                  maxLength={400}
                  placeholder="Tell fans what exclusive content they get by subscribing..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={textareaStyle}
                />
                <span style={characterCountStyle}>{bio.length}/400</span>
              </div>

              {/* Monthly Subscription Price */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Monthly VIP Subscription Price ($ USD)</label>
                <div style={{ position: "relative" }}>
                  <span style={currencyPrefixStyle}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="15 (Set 0 for Free Profile)"
                    value={subscriptionPrice}
                    onChange={(e) => setSubscriptionPrice(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: "36px" }}
                  />
                </div>
                <span style={hintStyle}>
                  Fans pay this monthly rate to unlock your VIP Exclusive videos, or set 0 for a free creator profile.
                </span>
              </div>

              {/* Social Links */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Social Links (Optional)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Instagram username (e.g. queenbella)"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="X / Twitter handle (e.g. queenbella)"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Telegram Channel / Handle (e.g. queenbellavip)"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Location & Website */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Lagos, Nigeria"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Website / Link</label>
                  <input
                    type="url"
                    placeholder="https://yourlink.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Perks Guarantee */}
              <div style={guaranteeCardStyle}>
                <ShieldCheck size={20} color="#f43f5e" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: "1.45" }}>
                  <b style={{ color: "#f4f4f5" }}>Verified Creator Status:</b> Your profile will display the official verified badge, VIP subscription button, direct fan tips, and 20 daily video uploads.
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" disabled={isLoading} style={submitBtnStyle}>
                {isLoading ? (
                  <div style={flexCenterGapStyle}>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Activating Creator Account...</span>
                  </div>
                ) : (
                  <div style={flexCenterGapStyle}>
                    <Sparkles size={18} />
                    <span>Launch Verified Creator Profile</span>
                  </div>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// 🖌 Styles (3-Tier Calm Black & Graphite Hierarchy)
const fullscreenContainerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000220,
  backgroundColor: "#09090b",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const topNavStyle = {
  height: "52px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  backgroundColor: "#09090b",
  flexShrink: 0
};

const navBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#f4f4f5",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const topNavTitleStyle = {
  fontSize: "15px",
  fontWeight: "700",
  color: "#f4f4f5",
  letterSpacing: "-0.2px"
};

const stepperContainerStyle = {
  backgroundColor: "#18181b",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  padding: "10px 16px",
  display: "flex",
  justifyContent: "center",
  flexShrink: 0
};

const stepperInnerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  width: "100%",
  maxWidth: "480px",
  justifyContent: "space-between"
};

const stepPillStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderRadius: "999px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const stepConnectorStyle = {
  flex: 1,
  height: "1px",
  background: "rgba(255, 255, 255, 0.1)",
  minWidth: "10px"
};

const scrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "20px 16px 60px",
  boxSizing: "border-box"
};

const innerContentStyle = {
  width: "100%",
  maxWidth: "500px",
  display: "flex",
  flexDirection: "column",
  gap: "14px"
};

const stepCardStyle = {
  background: "#18181b",
  borderRadius: "18px",
  padding: "24px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "12px",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)"
};

const stepIconCircleStyle = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "rgba(225, 29, 72, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "4px"
};

const stepHeadingStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: "800",
  color: "#f4f4f5"
};

const stepDescStyle = {
  margin: 0,
  fontSize: "13px",
  color: "#a1a1aa",
  lineHeight: 1.5
};

const emailBadgeBoxStyle = {
  width: "100%",
  background: "#27272a",
  borderRadius: "12px",
  padding: "12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  margin: "6px 0",
  boxSizing: "border-box"
};

const verifiedNoticeStyle = {
  width: "100%",
  background: "rgba(225, 29, 72, 0.12)",
  border: "1px solid rgba(225, 29, 72, 0.28)",
  color: "#f43f5e",
  padding: "12px 14px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  boxSizing: "border-box"
};

const uploadBoxStyle = {
  background: "#27272a",
  borderRadius: "12px",
  padding: "12px",
  border: "1px dashed rgba(255, 255, 255, 0.14)",
  display: "flex",
  flexDirection: "column",
  gap: "8px"
};

const previewThumbWrapStyle = {
  position: "relative",
  width: "100%",
  height: "84px",
  borderRadius: "8px",
  overflow: "hidden",
  background: "#09090b"
};

const previewThumbImgStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover"
};

const uploadedBadgeStyle = {
  position: "absolute",
  bottom: "6px",
  right: "6px",
  background: "rgba(24, 24, 27, 0.85)",
  color: "#f4f4f5",
  fontSize: "10px",
  fontWeight: "700",
  padding: "2px 7px",
  borderRadius: "6px"
};

const uploadTriggerBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: "#18181b",
  color: "#e4e4e7",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer"
};

const privacyNoteBoxStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(255, 255, 255, 0.04)",
  padding: "10px 12px",
  borderRadius: "10px",
  fontSize: "11px",
  color: "#a1a1aa",
  lineHeight: 1.4
};

const primaryActionBtnStyle = {
  width: "100%",
  background: "#e4e4e7",
  color: "#09090b",
  border: "none",
  borderRadius: "12px",
  padding: "14px 18px",
  fontSize: "14px",
  fontWeight: "800",
  cursor: "pointer",
  marginTop: "6px"
};

const secondaryGhostBtnStyle = {
  width: "100%",
  background: "transparent",
  color: "#a1a1aa",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "12px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer"
};

const flexCenterGapStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px"
};

const formStyle = {
  background: "#18181b",
  borderRadius: "18px",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "18px"
};

const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "6px" };
const labelStyle = { fontSize: "13px", fontWeight: "700", color: "#e4e4e7" };
const inputStyle = {
  width: "100%",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#f4f4f5",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};
const textareaStyle = {
  width: "100%",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#f4f4f5",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  resize: "none"
};
const characterCountStyle = { fontSize: "11px", color: "#71717a", alignSelf: "flex-end", marginTop: "2px" };
const hintStyle = { fontSize: "11px", color: "#a1a1aa", marginTop: "4px" };

const bannerPreviewStyle = {
  width: "100%",
  height: "105px",
  borderRadius: "12px",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)"
};

const bannerUploadOverlayBtnStyle = {
  position: "absolute",
  bottom: "8px",
  right: "8px",
  backgroundColor: "rgba(24, 24, 27, 0.85)",
  backdropFilter: "blur(6px)",
  padding: "6px 11px",
  borderRadius: "8px",
  fontSize: "11px",
  color: "#f4f4f5",
  fontWeight: "700",
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.15)"
};

const presetRowStyle = { display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" };
const presetBtnStyle = {
  flex: 1,
  minWidth: "90px",
  background: "#27272a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  padding: "7px 10px",
  color: "#e4e4e7",
  fontSize: "11px",
  fontWeight: "600",
  cursor: "pointer"
};

const categoryChipsContainer = { display: "flex", flexWrap: "wrap", gap: "8px" };
const chipStyle = {
  padding: "8px 12px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s"
};

const currencyPrefixStyle = {
  position: "absolute",
  left: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#f43f5e",
  fontWeight: "800",
  fontSize: "15px"
};

const guaranteeCardStyle = {
  background: "rgba(225, 29, 72, 0.08)",
  border: "1px solid rgba(225, 29, 72, 0.22)",
  borderRadius: "12px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  gap: "12px"
};

const errorBannerStyle = {
  background: "rgba(239, 68, 68, 0.12)",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  color: "#f87171",
  padding: "12px 16px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: "600"
};

const successBannerStyle = {
  background: "rgba(225, 29, 72, 0.12)",
  border: "1px solid rgba(225, 29, 72, 0.28)",
  color: "#f43f5e",
  padding: "12px 16px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "8px"
};

const submitBtnStyle = {
  width: "100%",
  background: "#e11d48",
  color: "#f4f4f5",
  border: "none",
  borderRadius: "14px",
  padding: "15px",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(225, 29, 72, 0.25)",
  marginTop: "6px"
};
