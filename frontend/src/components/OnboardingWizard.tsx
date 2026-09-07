/**
 * =============================================================================
 * Module: frontend/src/components/OnboardingWizard.tsx
 * Purpose: Fullscreen Vanguard Modern Gallery stepped glassmorphic onboarding wizard for user-supplied Telegram API login,
 *          OTP verification, 2FA cloud password management, and 1-click private vault channel provisioning.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts, frontend/src/api.ts
 * Public Members: OnboardingWizard
 * Side Effects: Submits authentication requests, sends MTProto OTP codes, and creates storage channels in Telegram.
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

interface OnboardingWizardProps {
  initialStatus: AuthStatusResponse;
  onComplete: (status: AuthStatusResponse) => void;
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
}) => {
  const [step, setStep] = useState<AuthStep>(initialStatus.step);
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
  const [vaultTitle, setVaultTitle] = useState<string>("Tellery Cloud Vault");
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
        setStep(res.step as AuthStep);
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
      setStep(res.step as AuthStep);
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
      setStep("ready");
    } catch (err: any) {
      setError(err.message || "Failed to create storage vault.");
    } finally {
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
      setStep("ready");
    } catch (err: any) {
      setError(err.message || "Failed to activate selected vault.");
    } finally {
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
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#070a13] text-slate-200 antialiased font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden overflow-y-auto min-h-screen">
      {/* Ambient Lighting Background Artifacts */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute -top-32 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-800/10 rounded-full blur-[130px]" />
      </div>

      {/* Top Header / Brand Anchor */}
      <header className="w-full relative z-20 pt-6 px-6 sm:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-600/30 border border-indigo-400/20 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.25)]">
            <Cloud className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-200">
            Tellery<span className="text-indigo-400 font-bold">.vault</span>
          </span>
        </div>

        {/* Quick Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/60 border border-slate-700/50 text-slate-300 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          Telegram MTProto 2.0 Live
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[500px] glass-card rounded-3xl p-6 sm:p-9 relative overflow-hidden transition-all duration-300">
          {/* Top Decorative Sheen Accent */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/15 blur-2xl rounded-full pointer-events-none" />

          {/* Product Header Section */}
          <section className="text-center flex flex-col items-center mb-6">
            {/* Glowing Cloud Vault Emblem */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-700/80 shadow-inner flex items-center justify-center mb-4 brand-glow group cursor-default">
              <Cloud className="w-7 h-7 text-indigo-300 group-hover:scale-105 transition-transform duration-300" />
            </div>

            <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight flex items-center gap-2">
              Tellery
            </h1>
            <p className="text-xs sm:text-sm font-normal text-slate-400 mt-1 max-w-xs">
              Unlimited Cloud Media Vault <span className="text-slate-600 font-semibold mx-1">·</span> Zero Subscription Fees
            </p>

            {/* Stepper Progress Indicator */}
            <div aria-label="Progress Indicator" className="flex items-center gap-1.5 mt-5">
              {(["need_credentials", "need_phone", "need_code", "need_vault", "ready"] as AuthStep[]).map((s, idx) => {
                const isActive = step === s || (step === "need_password" && s === "need_code");
                return (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? "w-6 bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                        : "w-1.5 bg-slate-700"
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
                className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-xs sm:text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center gap-2 text-white font-semibold text-base sm:text-lg tracking-tight">
                    <div className="p-1 rounded-md text-indigo-400">
                      <Key className="w-4 h-4" />
                    </div>
                    <span>Telegram MTProto Setup</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-400 pl-6 leading-relaxed">
                    Connect Tellery to your personal Telegram cloud storage via official MTProto API keys.
                  </p>
                </div>

                {/* Clear Step-by-Step Guide Card */}
                <div className="glass-card rounded-xl p-4 space-y-2.5 border border-indigo-500/20 bg-indigo-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Get free keys at my.telegram.org (~30s):
                    </span>
                    <a
                      href="https://my.telegram.org/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-200 transition-colors font-medium cursor-pointer"
                    >
                      <span>Open site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="text-[11px] text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Log in to <span className="font-mono text-indigo-300">my.telegram.org</span> with your phone.</li>
                    <li>Go to <strong className="text-white">API development tools</strong>.</li>
                    <li>Enter any app name (e.g. <span className="font-mono text-indigo-300">Tellery</span>) to create an app.</li>
                    <li>Copy and paste your <strong className="text-white">App api_id</strong> and <strong className="text-white">App api_hash</strong> below.</li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Telegram App API ID
                    </label>
                    <div className="glass-input rounded-xl px-3.5 py-3">
                      <input
                        type="number"
                        required
                        placeholder="e.g. 29384712"
                        value={apiId}
                        onChange={(e) => setApiId(e.target.value)}
                        className="w-full bg-transparent border-0 p-0 text-white font-mono text-sm focus:outline-none placeholder-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Telegram App API Hash
                    </label>
                    <div className="glass-input rounded-xl px-3.5 py-3">
                      <input
                        type="text"
                        required
                        placeholder="e.g. 8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d"
                        value={apiHash}
                        onChange={(e) => setApiHash(e.target.value)}
                        className="w-full bg-transparent border-0 p-0 text-white font-mono text-xs focus:outline-none placeholder-slate-600"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !apiId.trim() || !apiHash.trim()}
                  className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] shadow-[0_0_32px_-4px_rgba(99,102,241,0.45)] hover:shadow-[0_0_36px_rgba(99,102,241,0.65)] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Save & Continue</span>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform duration-200" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP 2: PHONE NUMBER (Vanguard Stitch Screen) */}
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
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center gap-2 text-white font-semibold text-base sm:text-lg tracking-tight">
                    <div className="p-1 rounded-md text-indigo-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span>Enter Phone Number</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-400 pl-6 leading-relaxed">
                    Telegram will deliver an official login code to your active Telegram sessions.
                  </p>
                </div>

                {/* Phone Input Block */}
                <div className="space-y-2 relative">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="phone-input">
                    Mobile Number (with Country Code)
                  </label>

                  {/* Tactile Input Container */}
                  <div className="glass-input rounded-xl px-3.5 py-3 transition-all duration-200 flex items-center gap-3">
                    {/* Country Tag Selector / Flag */}
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-md text-xs font-semibold text-slate-300 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
                      title="Select Country"
                    >
                      <span className="text-sm">{currentCountry.flag}</span>
                      <span>{currentCountry.code}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                    </button>

                    {/* Vertical Separator Divider */}
                    <div aria-hidden="true" className="h-5 w-[1px] bg-slate-700/70" />

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
                      className="w-full bg-transparent border-0 p-0 text-white font-mono text-sm sm:text-base tracking-wide focus:ring-0 placeholder-slate-600 focus:outline-none"
                    />

                    {/* Verified Indicator Icon */}
                    {isPhoneValid && (
                      <div className="text-emerald-400 flex-shrink-0" title="Valid telephone format">
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
                        className="absolute left-0 top-full mt-1.5 w-72 max-h-56 overflow-y-auto glass-card rounded-xl p-1.5 shadow-2xl border border-slate-700 z-50"
                      >
                        {COMMON_COUNTRIES.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCountry(c)}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between hover:bg-slate-800/80 transition-colors text-slate-200 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span className="font-medium">{c.name}</span>
                            </span>
                            <span className="font-mono text-slate-400">{c.dial}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Helper hint */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 px-0.5">
                    <span>
                      Example: <span className="font-mono text-slate-400">+6281234567890</span> or <span className="font-mono text-slate-400">+12025550143</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAlternativeNote(!showAlternativeNote)}
                      className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Need help?
                    </button>
                  </div>

                  {showAlternativeNote && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-200 leading-relaxed"
                    >
                      Your phone number connects directly to Telegram's secure MTProto protocol to authenticate your storage vault. No third-party servers ever touch your credentials.
                    </motion.div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep("need_credentials")}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5 focus:outline-none cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 active:scale-[0.985] shadow-[0_0_32px_-4px_rgba(99,102,241,0.45)] hover:shadow-[0_0_36px_rgba(99,102,241,0.65)] transition-all duration-200 flex items-center justify-center gap-2 group focus:outline-none cursor-pointer"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send Login Code</span>
                        <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform duration-200" />
                      </>
                    )}
                  </button>
                </div>

                {/* Trust & Encryption Footnote */}
                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>End-to-End Encrypted</span>
                  </div>
                  <div className="text-slate-400 hover:text-slate-300 cursor-help" title="Direct MTProto Telegram client connection">
                    Official Client Protocol
                  </div>
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
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center gap-2 text-white font-semibold text-base sm:text-lg tracking-tight">
                    <div className="p-1 rounded-md text-indigo-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span>Verify Login Code</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-400 pl-6 leading-relaxed">
                    We've sent a 5-digit verification code to your Telegram app for{" "}
                    <span className="text-indigo-400 font-semibold">{phoneNumber}</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    5-Digit Code
                  </label>
                  <div className="glass-input rounded-xl px-4 py-3">
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="•••••"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                      className="w-full bg-transparent border-0 p-0 text-center text-3xl tracking-[0.7em] font-mono text-indigo-400 font-bold focus:outline-none placeholder-slate-700"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => setStep("need_phone")}
                    className="hover:text-slate-200 underline cursor-pointer"
                  >
                    Change phone number
                  </button>
                  {resendCountdown > 0 ? (
                    <span className="text-slate-500 font-mono text-[11px]">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendCode}
                      className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneCode.length < 5}
                  className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 active:scale-[0.985] shadow-[0_0_32px_-4px_rgba(99,102,241,0.45)] hover:shadow-[0_0_36px_rgba(99,102,241,0.65)] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform duration-200" />
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
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center gap-2 text-white font-semibold text-base sm:text-lg tracking-tight">
                    <div className="p-1 rounded-md text-indigo-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <span>Two-Step Verification</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-400 pl-6 leading-relaxed">
                    Your Telegram account is protected by an additional cloud password.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Telegram Cloud Password
                  </label>
                  <div className="glass-input rounded-xl px-3.5 py-3 relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your 2FA password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      className="w-full bg-transparent border-0 p-0 text-white text-sm focus:outline-none placeholder-slate-600 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 active:scale-[0.985] shadow-[0_0_32px_-4px_rgba(99,102,241,0.45)] hover:shadow-[0_0_36px_rgba(99,102,241,0.65)] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Unlock Vault</span>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform duration-200" />
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
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center gap-2 text-white font-semibold text-base sm:text-lg tracking-tight">
                    <div className="p-1 rounded-md text-indigo-400">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <span>Select or Create Media Vault</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-400 pl-6 leading-relaxed">
                    {userProfile
                      ? `Welcome, ${userProfile.first_name}! Set up your private media storage vault.`
                      : "Configure a private storage channel for your media archive."}
                  </p>
                </div>

                {/* 1-Click Vault Creation */}
                <form onSubmit={handleCreateVault} className="glass-input rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Option 1: Create New Private Vault
                  </span>
                  <div className="glass-card rounded-lg px-3 py-2 border border-slate-700/60">
                    <input
                      type="text"
                      placeholder="Vault Channel Title"
                      value={vaultTitle}
                      onChange={(e) => setVaultTitle(e.target.value)}
                      className="w-full bg-transparent border-0 p-0 text-white text-sm focus:outline-none placeholder-slate-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 active:scale-[0.985] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.35)] cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Create & Connect Vault"}
                  </button>
                </form>

                {/* Existing Channels Selection */}
                {availableVaults.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Option 2: Use Existing Owned Channel
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {availableVaults.map((vault) => (
                        <button
                          key={vault.id}
                          type="button"
                          onClick={() => handleSelectExistingVault(vault)}
                          disabled={loading}
                          className="w-full p-2.5 rounded-xl glass-input hover:border-indigo-500/50 text-left flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span className="text-xs font-medium text-slate-200 truncate">{vault.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                            Connect
                          </span>
                        </button>
                      ))}
                    </div>
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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-indigo-500/20 to-indigo-950/40 border border-indigo-400/30 mx-auto flex items-center justify-center text-indigo-400 shadow-[0_0_32px_rgba(99,102,241,0.4)]">
                  <CheckCircle2 className="w-8 h-8 text-indigo-400" />
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">You're All Set!</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
                    Connected to{" "}
                    <span className="text-indigo-400 font-semibold">
                      {createdChannelInfo?.title || initialStatus.active_vault?.title || "Telegram Cloud Vault"}
                    </span>
                    . Your unlimited media vault is ready.
                  </p>
                </div>

                <div className="glass-input rounded-xl p-4 text-left text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Authenticated User:</span>
                    <span className="text-slate-200 font-medium">
                      {userProfile ? `${userProfile.first_name} ${userProfile.last_name || ""}` : "Telegram User"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage Architecture:</span>
                    <span className="text-slate-200 font-medium">Telegram MTProto + TDLib C++</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage Cost:</span>
                    <span className="text-indigo-400 font-semibold">$0 / Month (Unlimited)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 active:scale-[0.985] shadow-[0_0_32px_-4px_rgba(99,102,241,0.45)] hover:shadow-[0_0_36px_rgba(99,102,241,0.65)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Launch Tellery</span>
                      <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform duration-200" />
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Page Footer */}
      <footer className="relative z-20 w-full py-5 px-6 text-center text-xs text-slate-500 border-t border-slate-800/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p className="text-slate-500">
            Secured via <span className="text-slate-300 font-medium">Telegram MTProto 2.0 API</span> · Zero Knowledge Storage Architecture
          </p>
          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <span className="hover:text-slate-400 transition-colors">Privacy Shield</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">Documentation</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">Status</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
