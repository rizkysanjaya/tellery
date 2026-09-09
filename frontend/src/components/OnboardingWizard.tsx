/**
 * =============================================================================
 * Module: frontend/src/components/OnboardingWizard.tsx
 * Purpose: Fullscreen Silk Cloud neomorphic stepped onboarding wizard for user-supplied Telegram API login,
 *          OTP verification, 2FA cloud password management, and Welcome & Vault Strategy Hub (Step 5) with
 *          guided fresh Broadcast Channel provisioning vs existing channel connection.
 *          Supports dual Light & Dark theme modes, visible focus rings, and on-demand modal dismissal.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts, frontend/src/api.ts
 * Public Members: OnboardingWizard, OnboardingWizardProps
 * Side Effects: Submits authentication requests, sends MTProto OTP codes, creates private storage channels in Telegram,
 *               switches active vault channel, queries accessible channels.
 * =============================================================================
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  Key,
  Phone,
  MessageSquare,
  Lock,
  FolderPlus,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Check,
  Radio,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { AuthStatusResponse, AuthStep, VaultItem } from "../types";
import {
  fetchAuthStatus,
  submitCredentials,
  sendAuthCode,
  verifyAuthCode,
  verifyAuthPassword,
  createStorageVault,
  fetchVaults,
  setActiveVault,
} from "../api";

export interface OnboardingWizardProps {
  initialStatus: AuthStatusResponse;
  onComplete: (status: AuthStatusResponse) => void;
  initialStep?: AuthStep;
  onDismiss?: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

const COMMON_COUNTRIES = [
  { flag: "🇮🇩", name: "Indonesia", code: "ID", dial: "+62" },
  { flag: "🇺🇸", name: "United States", code: "US", dial: "+1" },
  { flag: "🇬🇧", name: "United Kingdom", code: "UK", dial: "+44" },
  { flag: "🇮🇳", name: "India", code: "IN", dial: "+91" },
  { flag: "🇸🇬", name: "Singapore", code: "SG", dial: "+65" },
  { flag: "🇲🇾", name: "Malaysia", code: "MY", dial: "+60" },
  { flag: "🇩🇪", name: "Germany", code: "DE", dial: "+49" },
  { flag: "🇫🇷", name: "France", code: "FR", dial: "+33" },
  { flag: "🇯🇵", name: "Japan", code: "JP", dial: "+81" },
  { flag: "🇦🇺", name: "Australia", code: "AU", dial: "+61" },
  { flag: "🇧🇷", name: "Brazil", code: "BR", dial: "+55" },
  { flag: "🇨🇦", name: "Canada", code: "CA", dial: "+1" },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialStatus,
  onComplete,
  initialStep,
  onDismiss,
  theme = "dark",
  onToggleTheme,
}) => {
  const [step, setStep] = useState<AuthStep>(initialStep || initialStatus.step);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Credentials
  const [apiId, setApiId] = useState<string>("");
  const [apiHash, setApiHash] = useState<string>("");

  // Step 2: Phone
  const [phoneNumber, setPhoneNumber] = useState<string>(initialStatus.phone || "");
  const [showCountryPicker, setShowCountryPicker] = useState<boolean>(false);

  // Step 3: OTP Code
  const [phoneCode, setPhoneCode] = useState<string>("");
  const [phoneCodeHash, setPhoneCodeHash] = useState<string>(initialStatus.phone_code_hash || "");
  const [resendCountdown, setResendCountdown] = useState<number>(60);

  // Step 4: 2FA Password
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Step 5: Vault Setup
  const [vaultSetupTab, setVaultSetupTab] = useState<"fresh" | "existing">("fresh");
  const [vaultTitle, setVaultTitle] = useState<string>("Tellery Cloud Vault");
  const [manualChannelId, setManualChannelId] = useState<string>("");
  const [availableVaults, setAvailableVaults] = useState<VaultItem[]>([]);
  const [createdChannelInfo, setCreatedChannelInfo] = useState<{ id: number; title: string } | null>(null);

  // Alternative options modal / note
  const [showAlternativeNote, setShowAlternativeNote] = useState<boolean>(false);

  // User Profile info
  const [userProfile, setUserProfile] = useState(initialStatus.user || null);

  // Detect country tag from phone number input
  const currentCountry = useMemo(() => {
    const clean = phoneNumber.trim();
    for (const c of COMMON_COUNTRIES) {
      if (clean.startsWith(c.dial) || clean.startsWith(c.dial.replace("+", ""))) {
        return c;
      }
    }
    return { flag: "🌐", name: "International", code: "INTL", dial: "+" };
  }, [phoneNumber]);

  // Validate phone format
  const isPhoneValid = useMemo(() => {
    const digitsOnly = phoneNumber.replace(/\D/g, "");
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }, [phoneNumber]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "need_code" && resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, resendCountdown]);

  // Load existing vaults if step reaches need_vault
  useEffect(() => {
    if (step === "need_vault") {
      fetchVaults()
        .then((vaults) => {
          const writeable = vaults.filter((v) => v.can_upload);
          setAvailableVaults(writeable);
        })
        .catch(() => {});
    }
  }, [step]);

  // 1. Handle Submit Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedId = parseInt(apiId.trim(), 10);
    const targetHash = apiHash.trim();

    if (!parsedId || isNaN(parsedId) || parsedId <= 0) {
      setError("Please enter a valid numeric Telegram API ID.");
      return;
    }

    if (!targetHash) {
      setError("Please enter your Telegram API Hash.");
      return;
    }

    if (parsedId === 2040 || targetHash === "b1844dda5045e8e4585d827ddf3f6de3") {
      setError(
        "Telegram has blocked the public desktop API ID (2040) for third-party apps. Please create your own free API ID and Hash at https://my.telegram.org."
      );
      return;
    }

    setLoading(true);
    try {
      await submitCredentials(parsedId, targetHash);
      setStep("need_phone");
    } catch (err: any) {
      setError(err.message || "Failed to save API credentials.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Send Phone Code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNumber.trim()) {
      setError("Please enter your Telegram phone number with country code.");
      return;
    }

    setLoading(true);
    try {
      const res = await sendAuthCode(phoneNumber.trim());
      setPhoneCodeHash(res.phone_code_hash);
      setResendCountdown(res.timeout || 60);
      setStep("need_code");
    } catch (err: any) {
      const errMsg = err.message || "Failed to send verification code.";
      setError(errMsg);
      if (
        errMsg.toLowerCase().includes("api_id") ||
        errMsg.toLowerCase().includes("credential") ||
        errMsg.toLowerCase().includes("blocked")
      ) {
        setStep("need_credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneCode.trim()) {
      setError("Please enter the verification code received from Telegram.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyAuthCode(phoneCode.trim(), phoneCodeHash);
      if (res.step === "need_password") {
        setStep("need_password");
      } else {
        if (res.user) setUserProfile(res.user);
        setStep("need_vault");
      }
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Verify 2FA Password
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please enter your Two-Step Verification cloud password.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyAuthPassword(password);
      if (res.user) setUserProfile(res.user);
      setStep("need_vault");
    } catch (err: any) {
      setError(err.message || "Incorrect 2FA password.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Create New Vault
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!vaultTitle.trim()) {
      setError("Please enter a title for your private storage vault.");
      return;
    }

    setLoading(true);
    try {
      const res = await createStorageVault(vaultTitle.trim());
      setCreatedChannelInfo({ id: res.channel_id, title: res.title });
      
      // Complete onboarding and immediately enter gallery
      try {
        const finalStatus = await fetchAuthStatus();
        onComplete(finalStatus);
      } catch {
        onComplete({
          is_authenticated: true,
          step: "ready",
          has_credentials: true,
          user: userProfile,
          active_vault: {
            id: res.channel_id,
            raw_id: Math.abs(res.channel_id),
            title: res.title,
            role: "owner",
            can_upload: true,
            can_delete: true,
            is_creator: true,
            is_admin: true,
            broadcast: true,
            media_count: 0,
            total_size_bytes: 0,
            is_active: true,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to create storage vault.");
      setLoading(false);
    }
  };

  // 5b. Handle Select Existing Vault
  const handleSelectExistingVault = async (vault: VaultItem) => {
    setError(null);
    setLoading(true);
    try {
      await setActiveVault(vault.id);
      setCreatedChannelInfo({ id: vault.id, title: vault.title });
      try {
        const finalStatus = await fetchAuthStatus();
        onComplete(finalStatus);
      } catch {
        onComplete({
          is_authenticated: true,
          step: "ready",
          has_credentials: true,
          user: userProfile,
          active_vault: vault,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to activate selected vault.");
      setLoading(false);
    }
  };

  // 5c. Handle Manual Channel Connect
  const handleConnectManualChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const raw = manualChannelId.trim();
    if (!raw) {
      setError("Please enter a Telegram Channel ID (e.g. -1001234567890).");
      return;
    }

    let parsedId = parseInt(raw.replace(/[^\d-]/g, ""), 10);
    if (isNaN(parsedId)) {
      setError("Please enter a valid numeric Channel ID (e.g. -1001234567890).");
      return;
    }

    if (parsedId > 0 && String(parsedId).length >= 9 && !raw.startsWith("-100")) {
      parsedId = -parseInt(`100${parsedId}`, 10);
    }

    setLoading(true);
    try {
      const res = await setActiveVault(parsedId);
      setCreatedChannelInfo({ id: parsedId, title: `Vault (${parsedId})` });
      try {
        const finalStatus = await fetchAuthStatus();
        onComplete(finalStatus);
      } catch {
        onComplete({
          is_authenticated: true,
          step: "ready",
          has_credentials: true,
          user: userProfile,
          active_vault: {
            id: parsedId,
            raw_id: Math.abs(parsedId),
            title: `Vault (${parsedId})`,
            role: (res?.role as "owner" | "viewer") || "owner",
            can_upload: res?.can_upload ?? true,
            can_delete: res?.can_delete ?? true,
            is_creator: res?.role === "owner",
            is_admin: true,
            broadcast: true,
            media_count: res?.media_count ?? 0,
            total_size_bytes: res?.total_size_bytes ?? 0,
            is_active: true,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to channel. Make sure your account has admin/post rights in that channel.");
      setLoading(false);
    }
  };

  // 6. Handle Launch Gallery
  const handleFinishOnboarding = async () => {
    setLoading(true);
    try {
      const finalStatus = await fetchAuthStatus();
      onComplete(finalStatus);
    } catch {
      onComplete({
        is_authenticated: true,
        step: "ready",
        has_credentials: true,
        user: userProfile,
      });
    } finally {
      setLoading(false);
    }
  };

  // Select country handler
  const handleSelectCountry = (c: (typeof COMMON_COUNTRIES)[0]) => {
    setShowCountryPicker(false);
    const digitsOnly = phoneNumber.replace(/^\+\d+\s*/, "");
    setPhoneNumber(`${c.dial} ${digitsOnly}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-background text-on-surface antialiased font-sans selection:bg-primary/20 selection:text-primary overflow-x-hidden overflow-y-auto min-h-screen">
      {/* Top Header / Brand Anchor */}
      <header className="w-full relative z-20 pt-6 px-6 sm:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-neo neo-raised bg-surface-base flex items-center justify-center text-primary shadow-sm">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-on-surface">Tellery</span>
            <span className="text-[11px] text-on-surface-variant font-mono block -mt-0.5">Media Vault</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Status Badge */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium neo-card bg-surface-base text-on-surface-variant border border-outline-variant/15 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Telegram MTProto</span>
          </div>

          {/* Visual Theme Switcher */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-primary transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-neo-lg neo-button text-xs font-semibold text-on-surface hover:text-primary transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <X className="w-3.5 h-3.5" />
              <span>Back to Gallery</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div
          className={`w-full ${
            step === "need_vault" ? "max-w-[640px]" : "max-w-[500px]"
          } neo-card bg-surface-base rounded-neo-xl border border-outline-variant/20 shadow-2xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300`}
        >
          {/* Product Header Section */}
          <section className="text-center flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-neo-xl neo-pressed bg-surface-container flex items-center justify-center mb-3.5 text-primary shadow-inner">
              <Cloud className="w-7 h-7 text-primary" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              {step === "need_vault" ? "Storage Channel Setup" : "Connect Telegram Cloud"}
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-sm">
              {step === "need_vault"
                ? "Configure your personal private channel for photo and video storage."
                : "Direct MTProto connection to your personal Telegram cloud."}
            </p>

            {/* Stepper Progress Indicator */}
            <div aria-label="Progress Indicator" className="flex items-center gap-1.5 mt-4">
              {(["need_credentials", "need_phone", "need_code", "need_vault", "ready"] as AuthStep[]).map((s, idx) => {
                const isActive = step === s || (step === "need_password" && s === "need_code");
                return (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? "w-7 bg-primary shadow-sm"
                        : "w-2 bg-surface-container-highest"
                    }`}
                  />
                );
              })}
            </div>
          </section>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-5 p-3.5 rounded-neo bg-error-container/30 border border-error/40 text-error flex items-start gap-2.5 text-xs sm:text-sm font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stepped Views */}
          <AnimatePresence mode="wait">
            {/* STEP 1: API CREDENTIALS */}
            {step === "need_credentials" && (
              <motion.form
                key="credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSaveCredentials}
                className="space-y-5 text-left"
              >
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2 text-on-surface font-bold text-base sm:text-lg tracking-tight">
                    <Key className="w-4 h-4 text-primary" />
                    <span>Telegram API Credentials</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-on-surface-variant leading-relaxed">
                    Connect Tellery to your private Telegram storage via official MTProto API keys.
                  </p>
                </div>

                {/* Clear Step-by-Step Guide Card */}
                <div className="neo-card bg-surface-container-low rounded-neo p-4 space-y-2.5 border border-outline-variant/15">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-primary" />
                      <span>Get API credentials from my.telegram.org:</span>
                    </span>
                    <a
                      href="https://my.telegram.org/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      <span>Open Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="text-[11px] text-on-surface-variant space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Log in with your phone at <span className="font-mono font-medium text-on-surface">my.telegram.org</span>.</li>
                    <li>Navigate to <strong>API development tools</strong>.</li>
                    <li>Create an app profile (e.g. <span className="font-mono font-medium text-on-surface">Tellery</span>).</li>
                    <li>Paste your <strong>api_id</strong> and <strong>api_hash</strong> below.</li>
                  </ol>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Telegram App API ID
                    </label>
                    <div className="neo-pressed bg-surface-container-lowest rounded-neo px-3.5 py-2.5 border border-outline-variant/15 focus-within:ring-2 focus-within:ring-primary focus-within:outline-none">
                      <input
                        type="number"
                        required
                        placeholder="e.g. 29384712"
                        value={apiId}
                        onChange={(e) => setApiId(e.target.value)}
                        className="w-full bg-transparent border-0 p-0 text-on-surface font-mono text-sm focus:outline-none placeholder:text-on-surface-variant/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Telegram App API Hash
                    </label>
                    <div className="neo-pressed bg-surface-container-lowest rounded-neo px-3.5 py-2.5 border border-outline-variant/15 focus-within:ring-2 focus-within:ring-primary focus-within:outline-none">
                      <input
                        type="text"
                        required
                        placeholder="e.g. 8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d"
                        value={apiHash}
                        onChange={(e) => setApiHash(e.target.value)}
                        className="w-full bg-transparent border-0 p-0 text-on-surface font-mono text-xs focus:outline-none placeholder:text-on-surface-variant/50"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !apiId.trim() || !apiHash.trim()}
                  className="w-full min-h-[44px] py-2.5 px-5 rounded-neo-lg text-sm font-bold neo-button-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP 2: PHONE NUMBER */}
            {step === "need_phone" && (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSendCode}
                className="space-y-5 text-left"
              >
                {/* Step Details & Instruction */}
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2 text-on-surface font-bold text-base sm:text-lg tracking-tight">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>Enter Phone Number</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-on-surface-variant leading-relaxed">
                    Telegram will send an official login code to your active Telegram app.
                  </p>
                </div>

                {/* Phone Input Block */}
                <div className="space-y-2 relative">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="phone-input">
                    Mobile Number (with Country Code)
                  </label>

                  {/* Tactile Input Container */}
                  <div className="neo-pressed bg-surface-container-lowest rounded-neo px-3 py-2 border border-outline-variant/15 transition-all flex items-center gap-2.5 focus-within:ring-2 focus-within:ring-primary">
                    {/* Country Tag Selector / Flag */}
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-neo text-xs font-semibold text-on-surface neo-button bg-surface-base transition-colors cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      title="Select Country"
                    >
                      <span className="text-sm">{currentCountry.flag}</span>
                      <span className="font-mono">{currentCountry.code}</span>
                      <ChevronDown className="w-3 h-3 text-on-surface-variant ml-0.5" />
                    </button>

                    {/* Vertical Separator Divider */}
                    <div aria-hidden="true" className="h-5 w-[1px] bg-outline-variant/30" />

                    {/* Core Phone Input */}
                    <input
                      id="phone-input"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      autoFocus
                      required
                      placeholder="+62 812 3456 7890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-transparent border-0 p-0 text-on-surface font-mono text-sm sm:text-base tracking-wide placeholder:text-on-surface-variant/50 focus:outline-none"
                    />

                    {/* Verified Indicator Icon */}
                    {isPhoneValid && (
                      <div className="text-emerald-500 flex-shrink-0" title="Valid telephone format">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    )}
                  </div>

                  {/* Country Picker Dropdown */}
                  <AnimatePresence>
                    {showCountryPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 top-full mt-1.5 w-72 max-h-56 overflow-y-auto neo-card bg-surface-base rounded-neo-lg p-1.5 shadow-2xl border border-outline-variant/20 z-50"
                      >
                        {COMMON_COUNTRIES.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCountry(c)}
                            className="w-full px-3 py-2 rounded-neo text-left text-xs flex items-center justify-between hover:bg-surface-container transition-colors text-on-surface cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span className="font-medium">{c.name}</span>
                            </span>
                            <span className="font-mono text-on-surface-variant">{c.dial}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Helper hint */}
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-0.5 px-0.5">
                    <span>
                      Format: <span className="font-mono text-on-surface">+6281234567890</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAlternativeNote(!showAlternativeNote)}
                      className="text-primary hover:underline transition-colors cursor-pointer"
                    >
                      Protocol Info
                    </button>
                  </div>

                  {showAlternativeNote && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 rounded-neo neo-card bg-surface-container-low border border-outline-variant/15 text-[11px] text-on-surface-variant leading-relaxed"
                    >
                      Tellery authenticates directly with Telegram's MTProto service over an encrypted connection. Session keys are stored locally on your machine.
                    </motion.div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep("need_credentials")}
                    className="min-h-[44px] px-4 py-2 rounded-neo-lg text-sm font-semibold neo-button text-on-surface hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 min-h-[44px] py-2.5 px-5 rounded-neo-lg text-sm font-bold neo-button-primary disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send Login Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Trust & Encryption Footnote */}
                <div className="mt-5 pt-3.5 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-on-surface-variant">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Official MTProto Handshake</span>
                  </div>
                  <span>Local Session Storage</span>
                </div>
              </motion.form>
            )}

            {/* STEP 3: OTP VERIFICATION CODE */}
            {step === "need_code" && (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyCode}
                className="space-y-5 text-left"
              >
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2 text-on-surface font-bold text-base sm:text-lg tracking-tight">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>Verify Login Code</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-on-surface-variant leading-relaxed">
                    Enter the 5-digit verification code sent to your Telegram app for{" "}
                    <span className="text-primary font-mono font-bold">{phoneNumber}</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    5-Digit Verification Code
                  </label>
                  <div className="neo-pressed bg-surface-container-lowest rounded-neo px-4 py-3 border border-outline-variant/15 focus-within:ring-2 focus-within:ring-primary">
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="•••••"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                      className="w-full bg-transparent border-0 p-0 text-center text-3xl tracking-[0.7em] font-mono text-primary font-bold focus:outline-none placeholder:text-on-surface-variant/30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <button
                    type="button"
                    onClick={() => setStep("need_phone")}
                    className="hover:text-on-surface underline cursor-pointer"
                  >
                    Change phone number
                  </button>
                  {resendCountdown > 0 ? (
                    <span className="text-on-surface-variant font-mono text-[11px]">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendCode}
                      className="text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneCode.length < 5}
                  className="w-full min-h-[44px] py-2.5 px-5 rounded-neo-lg text-sm font-bold neo-button-primary disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP 4: 2FA CLOUD PASSWORD */}
            {step === "need_password" && (
              <motion.form
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyPassword}
                className="space-y-5 text-left"
              >
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2 text-on-surface font-bold text-base sm:text-lg tracking-tight">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>Two-Step Verification</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-on-surface-variant leading-relaxed">
                    Enter your Telegram 2FA cloud password to complete login.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Telegram Cloud Password
                  </label>
                  <div className="neo-pressed bg-surface-container-lowest rounded-neo px-3.5 py-2.5 border border-outline-variant/15 relative flex items-center focus-within:ring-2 focus-within:ring-primary">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your 2FA password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      className="w-full bg-transparent border-0 p-0 text-on-surface text-sm focus:outline-none placeholder:text-on-surface-variant/50 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full min-h-[44px] py-2.5 px-5 rounded-neo-lg text-sm font-bold neo-button-primary disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Unlock Storage</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP 5: VAULT SELECTION / CREATION */}
            {step === "need_vault" && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 text-left"
              >
                {/* 1. Welcome & Philosophy Header */}
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2 text-on-surface font-bold text-base sm:text-lg tracking-tight">
                    <FolderPlus className="w-4 h-4 text-primary" />
                    <span>
                      {userProfile?.first_name
                        ? `Welcome, ${userProfile.first_name}!`
                        : "Welcome to Tellery!"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-on-surface-variant leading-relaxed">
                    Tellery uses private Telegram broadcast channels for unlimited, direct cloud media storage.
                  </p>
                </div>

                {/* 2. Architecture Philosophy & Recommendation Callout */}
                <div className="p-3.5 rounded-neo neo-card bg-surface-base border border-outline-variant/15 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Architectural Recommendation: Dedicated Channel</span>
                  </div>
                  <p className="text-on-surface-variant text-[11px] sm:text-xs leading-relaxed">
                    We recommend creating a dedicated private broadcast channel solely for Tellery. Channels with chat history, stickers, and voice notes can cause rate limit delays during media indexing.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <div className="flex items-start gap-2 p-2 rounded-neo bg-surface-container-low border border-outline-variant/15">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-on-surface-variant">
                        <strong className="text-on-surface block font-semibold">Broadcast Channel</strong>
                        Pure media warehouse, silent, zero chat spam, highest MTProto throughput.
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-neo bg-surface-container-low border border-outline-variant/15">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-on-surface-variant">
                        <strong className="text-on-surface block font-semibold">Shared Group Chat</strong>
                        Chatter, stickers, and reactions trigger Telegram FloodWait rate limits.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Segmented Tab Switcher */}
                <div className="p-1 rounded-neo-lg neo-pressed bg-surface-container-lowest flex gap-1 border border-outline-variant/10">
                  <button
                    type="button"
                    onClick={() => setVaultSetupTab("fresh")}
                    className={`flex-1 py-2 px-3 rounded-neo text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                      vaultSetupTab === "fresh"
                        ? "neo-pressed bg-surface-base text-primary font-bold shadow-sm"
                        : "neo-button bg-surface-base text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Create Fresh Vault</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultSetupTab("existing")}
                    className={`flex-1 py-2 px-3 rounded-neo text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                      vaultSetupTab === "existing"
                        ? "neo-pressed bg-surface-base text-primary font-bold shadow-sm"
                        : "neo-button bg-surface-base text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-on-surface-variant" />
                    <span>Connect Existing Channel</span>
                  </button>
                </div>

                {/* 4. Tab 1: Create Fresh Vault (Recommended) */}
                {vaultSetupTab === "fresh" && (
                  <form onSubmit={handleCreateVault} className="space-y-4">
                    {/* Vault Title Input */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Private Channel Title
                      </label>
                      <div className="neo-pressed bg-surface-container-lowest rounded-neo px-3.5 py-2.5 border border-outline-variant/15 focus-within:ring-2 focus-within:ring-primary">
                        <input
                          type="text"
                          placeholder="e.g. Tellery Cloud Vault"
                          value={vaultTitle}
                          onChange={(e) => setVaultTitle(e.target.value)}
                          className="w-full bg-transparent border-0 p-0 text-on-surface text-sm focus:outline-none placeholder:text-on-surface-variant/50"
                        />
                      </div>
                    </div>

                    {/* Authentic Telegram App Channel Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-primary" />
                          Raw Telegram Storage Feed Preview:
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-mono">Telegram Desktop</span>
                      </div>

                      {/* Telegram Window Frame */}
                      <div className="relative rounded-neo-xl overflow-hidden border border-outline-variant/25 shadow-xl bg-surface-container-lowest group">
                        {/* macOS/Desktop Window Titlebar */}
                        <div className="flex items-center justify-between px-3.5 py-2 bg-surface-container border-b border-outline-variant/15 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          </div>
                          <div className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5 truncate max-w-[240px]">
                            <span>Telegram · {vaultTitle.trim() || "Tellery Cloud Vault"}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-base text-primary border border-outline-variant/15 font-mono">
                            MTProto Feed
                          </span>
                        </div>

                        {/* Real Telegram Channel Screenshot */}
                        <div className="relative overflow-hidden aspect-[16/9] w-full bg-surface-container-lowest">
                          <img
                            src="/telegram_vault_preview.jpg"
                            alt="Telegram App Channel Storage Preview"
                            className="w-full h-full object-cover object-top"
                            loading="eager"
                          />
                          {/* Bottom gradient overlay for contrast */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                          {/* Dynamic Active Channel Indicator Banner */}
                          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <div className="px-2.5 py-1 rounded-neo bg-black/80 text-[11px] text-white flex items-center gap-2 shadow-md">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>
                                Target: <strong className="font-semibold">{vaultTitle.trim() || "Tellery Cloud Vault"}</strong>
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-neo bg-black/70 text-[10px] text-slate-300 font-mono">
                              Direct Cloud Feed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reassurance Callout Tooltip */}
                      <div className="flex items-start gap-3 p-3.5 rounded-neo neo-card bg-surface-base border border-outline-variant/15 text-left">
                        <div className="p-1.5 rounded-neo bg-primary/10 text-primary shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="text-xs space-y-1 leading-relaxed">
                          <div className="font-semibold text-on-surface">Automated EXIF Organization</div>
                          <p className="text-on-surface-variant text-[11px] sm:text-xs">
                            While Telegram acts as your raw distributed blob store, Tellery organizes photos by EXIF capture date, aggregates albums, generates 60fps streaming buffers, and manages trash recovery automatically.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 1-Click CTA */}
                    <button
                      type="submit"
                      disabled={loading || !vaultTitle.trim()}
                      className="w-full min-h-[44px] py-3 px-5 rounded-neo-lg text-sm font-bold neo-button-primary disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Provisioning Storage Vault...</span>
                        </div>
                      ) : (
                        <>
                          <span>Create &amp; Connect Vault →</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* 5. Tab 2: Connect Existing Channel */}
                {vaultSetupTab === "existing" && (
                  <div className="space-y-4">
                    {/* Auto-Scanned Owned Channels */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                          Available Owned Channels ({availableVaults.length})
                        </span>
                        {availableVaults.length > 0 && (
                          <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-mono font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ready to connect
                          </span>
                        )}
                      </div>

                      {availableVaults.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {availableVaults.map((vault) => (
                            <button
                              key={vault.id}
                              type="button"
                              onClick={() => handleSelectExistingVault(vault)}
                              disabled={loading}
                              className="w-full p-3 rounded-neo neo-card bg-surface-base hover:bg-surface-container border border-outline-variant/15 text-left flex items-center justify-between transition-all group cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                            >
                              <div className="min-w-0 flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-neo neo-pressed bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                  {vault.title ? vault.title.charAt(0).toUpperCase() : "C"}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                                    {vault.title}
                                  </div>
                                  <div className="text-[10px] text-on-surface-variant font-mono">
                                    ID: {vault.id} {vault.role && `• ${vault.role.toUpperCase()}`}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs px-3 py-1 rounded-neo neo-button text-primary font-bold shrink-0">
                                Connect →
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-neo neo-card bg-surface-base border border-outline-variant/15 text-center space-y-1.5">
                          <p className="text-xs text-on-surface font-semibold">No owned broadcast channels detected</p>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">
                            Telegram broadcast channels are separate from private chat groups. We recommend switching to the fresh vault tab to create one in seconds.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Manual Channel ID Connection */}
                    <form onSubmit={handleConnectManualChannel} className="p-3.5 rounded-neo neo-card bg-surface-base border border-outline-variant/15 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                        <FolderPlus className="w-3.5 h-3.5 text-primary" />
                        <span>Or Connect by Channel ID</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        If your channel wasn't auto-detected, enter its Telegram ID (e.g. <span className="font-mono text-primary">-1001234567890</span>). Your account must have post permissions.
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1 neo-pressed bg-surface-container-lowest rounded-neo px-3 py-2 border border-outline-variant/15 focus-within:ring-2 focus-within:ring-primary">
                          <input
                            type="text"
                            placeholder="-100..."
                            value={manualChannelId}
                            onChange={(e) => setManualChannelId(e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-on-surface text-xs font-mono focus:outline-none placeholder:text-on-surface-variant/50"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={loading || !manualChannelId.trim()}
                          className="py-2 px-4 rounded-neo text-xs font-bold neo-button-primary disabled:opacity-50 transition-all shrink-0 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                        >
                          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 6: READY */}
            {step === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-2"
              >
                <div className="w-16 h-16 rounded-neo-xl neo-pressed bg-surface-base border border-emerald-500/30 mx-auto flex items-center justify-center text-emerald-500 shadow-inner">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">You're All Set!</h2>
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                    Connected to{" "}
                    <span className="text-primary font-semibold">
                      {createdChannelInfo?.title || initialStatus.active_vault?.title || "Telegram Cloud Vault"}
                    </span>
                    . Your personal media vault is ready.
                  </p>
                </div>

                <div className="neo-card bg-surface-container-low rounded-neo p-4 text-left text-xs space-y-2 border border-outline-variant/15">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Authenticated User:</span>
                    <span className="text-on-surface font-medium">
                      {userProfile ? `${userProfile.first_name} ${userProfile.last_name || ""}` : "Telegram User"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Storage Architecture:</span>
                    <span className="text-on-surface font-medium font-mono text-[11px]">Telegram MTProto + TDLib C++</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Cloud Storage:</span>
                    <span className="text-primary font-bold">Unlimited Vault</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={loading}
                  className="w-full min-h-[44px] py-3 px-5 rounded-neo-lg text-sm font-bold neo-button-primary disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Launch Tellery</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Page Footer */}
      <footer className="relative z-20 w-full py-4 px-6 text-center text-xs text-on-surface-variant border-t border-outline-variant/15">
        <p>
          Powered by <span className="text-on-surface font-semibold">Telegram MTProto 2.0</span> · Direct client-to-cloud connection · Local database caching
        </p>
      </footer>
    </div>
  );
};
