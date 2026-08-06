import { useState, useRef, useEffect, useCallback } from "react";

// ── Backend KYC API helpers ────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function kycFetch(path: string, options?: RequestInit) {
  if (!API_BASE || !getToken()) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((json as any)?.error?.message ?? "KYC API error"), { code: (json as any)?.error?.code });
    return json;
  } catch { return null; }
}

/** Upload a document to backend storage, return storage key */
async function uploadDocument(docType: "front" | "back" | "selfie" | "poa", dataUrl: string): Promise<string | null> {
  const res = await kycFetch(`/api/v1/kyc/documents/${docType}`, {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
  return res?.data?.key ?? null;
}
import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { ArrowLeft, Upload, Camera, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { useVerification } from "../contexts/VerificationContext";
import { useNotifications } from "../contexts/NotificationContext";
import { documentVerificationService } from "../services/documentVerificationService";
import { userProfileService } from "../services/userProfileService";

type VerificationStep = "country" | "idType" | "personalInfo" | "frontUpload" | "backUpload" | "selfie" | "poa" | "review" | "submitted";

interface Country {
  code: string;
  name: string;
  idTypes: string[];
}

// Fallback list — matches backend SUPPORTED_COUNTRIES exactly
const COUNTRIES_FALLBACK: Country[] = [
  { code: "AR", name: "Argentina",     idTypes: ["DNI", "Passport"] },
  { code: "AU", name: "Australia",     idTypes: ["Driver's License", "Passport"] },
  { code: "BR", name: "Brazil",        idTypes: ["RG", "Passport"] },
  { code: "CA", name: "Canada",        idTypes: ["Driver's License", "Passport"] },
  { code: "CN", name: "China",         idTypes: ["Resident ID", "Passport"] },
  { code: "EG", name: "Egypt",         idTypes: ["National ID", "Passport"] },
  { code: "FR", name: "France",        idTypes: ["Carte Nationale", "Passport"] },
  { code: "DE", name: "Germany",       idTypes: ["Personalausweis", "Passport"] },
  { code: "GH", name: "Ghana",         idTypes: ["Ghana Card", "Passport"] },
  { code: "IN", name: "India",         idTypes: ["Aadhaar", "Passport"] },
  { code: "ID", name: "Indonesia",     idTypes: ["KTP", "Passport"] },
  { code: "IT", name: "Italy",         idTypes: ["Carta d'Identità", "Passport"] },
  { code: "JP", name: "Japan",         idTypes: ["My Number Card", "Passport"] },
  { code: "KE", name: "Kenya",         idTypes: ["National ID", "Passport"] },
  { code: "MX", name: "Mexico",        idTypes: ["INE", "Passport"] },
  { code: "NZ", name: "New Zealand",   idTypes: ["Driver's License", "Passport"] },
  { code: "NG", name: "Nigeria",       idTypes: ["NIN Slip", "Passport"] },
  { code: "PH", name: "Philippines",   idTypes: ["PhilSys ID", "Passport"] },
  { code: "RU", name: "Russia",        idTypes: ["Passport (Internal)", "Passport"] },
  { code: "SG", name: "Singapore",     idTypes: ["NRIC", "Passport"] },
  { code: "ZA", name: "South Africa",  idTypes: ["Green ID Book", "Passport"] },
  { code: "KR", name: "South Korea",   idTypes: ["Resident Registration", "Passport"] },
  { code: "GB", name: "United Kingdom",idTypes: ["Driver's License", "Passport"] },
  { code: "US", name: "United States", idTypes: ["Driver's License", "Passport"] },
];

export default function IdentityVerification() {
  const navigate = useNavigate();
  const { submitVerification } = useVerification();
  const { addNotification } = useNotifications();
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const poaInputRef = useRef<HTMLInputElement>(null);

  // Load supported countries from backend; fall back to static list
  const [COUNTRIES, setCountries] = useState<Country[]>(COUNTRIES_FALLBACK);
  useEffect(() => {
    kycFetch("/api/v1/kyc/countries").then((json) => {
      const list: Country[] = json?.data;
      if (Array.isArray(list) && list.length > 0) setCountries(list);
    });
  }, []);

  // Load verification progress from localStorage
  const loadVerificationProgress = () => {
    try {
      const stored = localStorage.getItem("identityVerificationProgress");
      if (stored) {
        const progress = JSON.parse(stored);
        return progress;
      }
    } catch (e) {
      console.error("Error loading verification progress:", e);
    }
    return null;
  };

  const savedProgress = loadVerificationProgress();

  const [currentStep, setCurrentStep] = useState<VerificationStep>(
    savedProgress?.currentStep || "country"
  );
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(
    savedProgress?.selectedCountry || null
  );
  const [selectedIDType, setSelectedIDType] = useState<string | null>(
    savedProgress?.selectedIDType || null
  );
  const [frontImage, setFrontImage] = useState<string | null>(
    savedProgress?.frontImage || null
  );
  const [backImage, setBackImage] = useState<string | null>(
    savedProgress?.backImage || null
  );
  const [selfieImage, setSelfieImage] = useState<string | null>(
    savedProgress?.selfieImage || null
  );
  const [showPhoneRequiredDialog, setShowPhoneRequiredDialog] = useState(false);

  // Personal Information state
  const [fullName, setFullName] = useState(savedProgress?.fullName || "");
  const [dateOfBirth, setDateOfBirth] = useState(savedProgress?.dateOfBirth || "");
  const [idNumber, setIdNumber] = useState(savedProgress?.idNumber || "");

  // Proof of Address (POA) state
  const [address, setAddress] = useState(
    savedProgress?.address || {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    }
  );
  const [poaDocument, setPoaDocument] = useState<string | null>(
    savedProgress?.poaDocument || null
  );
  const [poaDocumentName, setPoaDocumentName] = useState<string>(
    savedProgress?.poaDocumentName || ""
  );

  // Calculate age from date of birth
  const calculateAge = (dob: string): number => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  // Save verification progress to localStorage whenever state changes
  useEffect(() => {
    if (currentStep !== "submitted") {
      const progress = {
        currentStep,
        selectedCountry,
        selectedIDType,
        frontImage,
        backImage,
        selfieImage,
        fullName,
        dateOfBirth,
        idNumber,
        address,
        poaDocument,
        poaDocumentName,
      };
      localStorage.setItem("identityVerificationProgress", JSON.stringify(progress));
      console.log("💾 Verification progress saved to localStorage");
    }
  }, [
    currentStep,
    selectedCountry,
    selectedIDType,
    frontImage,
    backImage,
    selfieImage,
    fullName,
    dateOfBirth,
    idNumber,
    address,
    poaDocument,
    poaDocumentName,
  ]);

  // Check if verification was already submitted
  useEffect(() => {
    const pendingVerification = localStorage.getItem("pendingVerificationMetadata");
    if (pendingVerification && currentStep !== "submitted") {
      // User already submitted verification, show the submitted page
      setCurrentStep("submitted");
      console.log("✅ Verification already submitted - showing submitted page");
    }
  }, []);

  // Check phone verification on component mount
  useEffect(() => {
    const profile = userProfileService.getProfile();
    if (!profile || !profile.phoneVerified) {
      setShowPhoneRequiredDialog(true);
    }
  }, []);

  // Compress and resize image to prevent page freeze (target: 80KB-500KB)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Calculate target size based on original dimensions
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Start with high quality and reduce if needed
          let quality = 0.85;
          let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

          // Target size: 80KB - 500KB
          const TARGET_SIZE = 500 * 1024; // 500KB in bytes
          const MIN_SIZE = 80 * 1024; // 80KB in bytes

          // Reduce quality if image is too large
          while (compressedDataUrl.length > TARGET_SIZE && quality > 0.3) {
            quality -= 0.05;
            compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          // Calculate final size
          const finalSizeKB = Math.round(compressedDataUrl.length / 1024);
          console.log(
            `📸 Image compressed: ${Math.round(file.size / 1024)}KB → ${finalSizeKB}KB (quality: ${Math.round(quality * 100)}%)`
          );

          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (
    file: File,
    setter: (url: string) => void,
    type: "front" | "back" | "selfie"
  ) => {
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    const maxSize = 10 * 1024 * 1024; // 10MB (before compression)

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPG or PNG)");
      return;
    }

    if (file.size > maxSize) {
      toast.error("Image size must be less than 10MB");
      return;
    }

    try {
      // Show processing toast
      toast.info("Processing image...", { duration: 1000 });

      // Compress the image
      const compressedImage = await compressImage(file);

      setter(compressedImage);
      toast.success(
        type === "front"
          ? "Front image uploaded"
          : type === "back"
          ? "Back image uploaded"
          : "Selfie captured"
      );
    } catch (error) {
      console.error("Error compressing image:", error);
      toast.error("Failed to process image. Please try again.");
    }
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setCurrentStep("idType");
  };

  const handleIDTypeSelect = (idType: string) => {
    setSelectedIDType(idType);
    setCurrentStep("personalInfo");
  };

  const handlePOAUpload = (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid document (JPG, PNG, or PDF)");
      return;
    }

    if (file.size > maxSize) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPoaDocument(reader.result as string);
      setPoaDocumentName(file.name);
      toast.success("Proof of address uploaded successfully");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    try {
      // Validate age (must be 18+)
      const age = calculateAge(dateOfBirth);
      if (age < 18) {
        toast.error("Verification failed – User must be 18+", { duration: 5000 });
        setCurrentStep("personalInfo");
        return;
      }

      // Validate all required images are present
      if (!frontImage || !selfieImage || !poaDocument) {
        toast.error("Please upload all required documents");
        return;
      }

      toast.info("Uploading verification documents...", { duration: 3000 });

      // ── STEP 1: Upload documents to backend (real storage) ──────────────────
      let frontDocKey: string | null = null;
      let selfieKey:   string | null = null;
      let backDocKey:  string | null = null;
      let poaKey:      string | null = null;

      frontDocKey = await uploadDocument("front", frontImage);
      if (!frontDocKey) { toast.error("Failed to upload front document. Please try again."); return; }

      selfieKey = await uploadDocument("selfie", selfieImage);
      if (!selfieKey) { toast.error("Failed to upload selfie. Please try again."); return; }

      if (backImage) {
        backDocKey = await uploadDocument("back", backImage);
      }
      if (poaDocument) {
        poaKey = await uploadDocument("poa", poaDocument);
      }

      // ── STEP 2: Submit KYC to backend (async verification pipeline) ─────────
      toast.info("Submitting verification...", { duration: 2000 });

      const kycPayload: Record<string, any> = {
        countryCode:  selectedCountry?.code ?? "",
        idType:       selectedIDType ?? "",
        fullName,
        dateOfBirth,
        address:    address.street,
        city:       address.city,
        state:      address.state,
        country:    address.country,
        postalCode: address.postalCode,
        frontDocKey,
        selfieKey,
      };
      if (backDocKey)  kycPayload.backDocKey = backDocKey;
      if (poaKey)      kycPayload.poaKey     = poaKey;

      const kycRes = await kycFetch("/api/v1/kyc", {
        method: "POST",
        body: JSON.stringify(kycPayload),
      });

      if (!kycRes) {
        // Backend unavailable — fall back to local submission
        const verificationData = {
          fullName, dateOfBirth, address: address.street, city: address.city,
          state: address.state, country: address.country, postalCode: address.postalCode,
          idType: selectedIDType || "", idNumber,
          idFrontImage: null, idBackImage: null, selfieImage: null,
        };
        await submitVerification(verificationData as any);
      } else {
        // Backend accepted — update local verification context to "pending"
        const verificationData = {
          fullName, dateOfBirth, address: address.street, city: address.city,
          state: address.state, country: address.country, postalCode: address.postalCode,
          idType: selectedIDType || "", idNumber,
          idFrontImage: null, idBackImage: null, selfieImage: null,
        };
        await submitVerification(verificationData as any);
      }

      localStorage.setItem("pendingVerificationMetadata", JSON.stringify({ submittedAt: Date.now(), country: selectedCountry?.name, idType: selectedIDType }));
      localStorage.removeItem("identityVerificationProgress");
      setCurrentStep("submitted");
      toast.success("✅ Verification submitted! Your documents are being reviewed.", { duration: 5000 });

      console.log("✅ Verification submitted - will be approved in 3 minutes");
      console.log("📋 Verification Results:", {
        faceMatch: verificationResult.faceVerification.confidence + "%",
        addressVerified: true,
      });
    } catch (error) {
      console.error("Verification submission error:", error);
      toast.error("An error occurred during verification. Please try again.");
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "country", label: "Country" },
      { key: "idType", label: "ID Type" },
      { key: "frontUpload", label: "Front" },
      { key: "backUpload", label: "Back" },
      { key: "selfie", label: "Selfie" },
      { key: "poa", label: "POA" },
      { key: "review", label: "Review" },
    ];

    const stepOrder = ["country", "idType", "personalInfo", "frontUpload", "backUpload", "selfie", "poa", "review", "submitted"];
    const currentIndex = stepOrder.indexOf(currentStep);

    return (
      <div className="flex items-center justify-between mb-6 md:mb-8 overflow-x-auto px-2 sm:px-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = stepOrder[index] === currentStep;

          return (
            <div key={step.key} className="flex-1 flex items-center min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-[#d4af37] text-black"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" /> : index + 1}
                </div>
                <p className={`text-[10px] sm:text-xs mt-1 sm:mt-2 text-center whitespace-nowrap ${isCurrent ? "text-[#d4af37]" : "text-gray-600 dark:text-gray-400"}`}>
                  {step.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 sm:h-1 flex-1 mx-1 sm:mx-2 min-w-[8px] ${isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ResponsiveLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/profile")}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Profile
          </Button>
        </div>

        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6 md:p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Identity Verification</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Verify your identity to unlock full platform features
            </p>

            {currentStep !== "submitted" && renderStepIndicator()}

            {/* Step 1: Country Selection */}
            {currentStep === "country" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select Your Country</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Choose your country of residence for identity verification
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="country-select" className="text-gray-900 dark:text-white mb-2 block flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Country
                    </Label>
                    <Select
                      value={selectedCountry?.code || ""}
                      onValueChange={(value) => {
                        const country = COUNTRIES.find(c => c.code === value);
                        if (country) handleCountrySelect(country);
                      }}
                    >
                      <SelectTrigger className="w-full px-4 py-3 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium">
                        <SelectValue placeholder="Select your country..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 max-h-60">
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                            🌎 {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCountry && (
                    <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300">Selected: {selectedCountry.name}</p>
                          <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                            Accepted ID types: {selectedCountry.idTypes.join(", ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: ID Type Selection */}
            {currentStep === "idType" && selectedCountry && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Select ID Type for {selectedCountry.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Choose one of the accepted identification documents
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedCountry.idTypes.map((idType) => (
                    <button
                      key={idType}
                      onClick={() => handleIDTypeSelect(idType)}
                      className="p-6 bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#d4af37] hover:bg-gray-200 dark:hover:bg-gray-800 transition-all text-center"
                    >
                      <div className="text-4xl mb-3">📄</div>
                      <span className="text-gray-900 dark:text-white font-medium">{idType}</span>
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("country")}
                  className="mt-6"
                >
                  Back
                </Button>
              </div>
            )}

            {/* Step 3: Personal Information */}
            {currentStep === "personalInfo" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Personal Information
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Enter your personal details as they appear on your ID document
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name (as on ID)</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full legal name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">You must be at least 18 years old</p>
                  </div>

                  <div>
                    <Label htmlFor="idNumber">ID Number</Label>
                    <Input
                      id="idNumber"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="Enter your ID number"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("idType")}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!fullName || !dateOfBirth || !idNumber) {
                        toast.error("Please fill in all required fields");
                        return;
                      }
                      const age = calculateAge(dateOfBirth);
                      if (age < 18) {
                        toast.error("Verification failed – User must be 18+", { duration: 5000 });
                        return;
                      }
                      setCurrentStep("frontUpload");
                    }}
                    disabled={!fullName || !dateOfBirth || !idNumber}
                    className="flex-1 bg-[#d4af37] hover:bg-[#c4a137] text-black"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Upload Front of ID */}
            {currentStep === "frontUpload" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Front of {selectedIDType}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Make sure the document is clear and all details are visible
                </p>

                <input
                  type="file"
                  ref={frontInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, setFrontImage, "front");
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => frontInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                    frontImage
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-400 dark:border-gray-600 hover:border-[#d4af37] bg-gray-100 dark:bg-gray-800/30"
                  }`}
                >
                  {frontImage ? (
                    <div>
                      <img src={frontImage} alt="Front" className="max-w-full max-h-64 mx-auto rounded mb-4" />
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-500 font-medium">Front uploaded successfully</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-900 dark:text-white font-medium mb-2">Click to upload front of ID</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">JPG or PNG, max 5MB</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("personalInfo")}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep("backUpload")}
                    disabled={!frontImage}
                    className="flex-1 bg-[#d4af37] hover:bg-[#c4a137] text-black"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Upload Back of ID */}
            {currentStep === "backUpload" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Back of {selectedIDType}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Make sure the document is clear and all details are visible
                </p>

                <input
                  type="file"
                  ref={backInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, setBackImage, "back");
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => backInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                    backImage
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-400 dark:border-gray-600 hover:border-[#d4af37] bg-gray-100 dark:bg-gray-800/30"
                  }`}
                >
                  {backImage ? (
                    <div>
                      <img src={backImage} alt="Back" className="max-w-full max-h-64 mx-auto rounded mb-4" />
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-500 font-medium">Back uploaded successfully</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-900 dark:text-white font-medium mb-2">Click to upload back of ID</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">JPG or PNG, max 5MB</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("frontUpload")}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep("selfie")}
                    disabled={!backImage}
                    className="flex-1 bg-[#d4af37] hover:bg-[#c4a137] text-black"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Selfie/Face Verification */}
            {currentStep === "selfie" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Take a Selfie</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Take a clear photo of your face for verification. This will be matched with your ID photo.
                </p>

                <input
                  type="file"
                  ref={selfieInputRef}
                  accept="image/*"
                  capture="user"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, setSelfieImage, "selfie");
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => selfieInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                    selfieImage
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-400 dark:border-gray-600 hover:border-[#d4af37] bg-gray-100 dark:bg-gray-800/30"
                  }`}
                >
                  {selfieImage ? (
                    <div>
                      <img src={selfieImage} alt="Selfie" className="max-w-full max-h-64 mx-auto rounded-full mb-4" />
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-500 font-medium">Selfie captured successfully</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Click to retake</p>
                    </div>
                  ) : (
                    <div>
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-900 dark:text-white font-medium mb-2">Click to take a selfie</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Make sure your face is clearly visible</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("backUpload")}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep("poa")}
                    disabled={!selfieImage}
                    className="flex-1 bg-[#d4af37] hover:bg-[#c4a137] text-black"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Proof of Address (POA) */}
            {currentStep === "poa" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Proof of Address</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Provide your residential address and upload a proof of address document (utility bill, bank statement, or government letter dated within the last 3 months)
                </p>

                {/* Address Input Fields */}
                <div className="space-y-4 mb-6">
                  <div>
                    <Label htmlFor="street" className="text-gray-900 dark:text-white mb-2 block">
                      Street Address
                    </Label>
                    <Input
                      id="street"
                      type="text"
                      placeholder="Enter your street address"
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      className="bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city" className="text-gray-900 dark:text-white mb-2 block">
                        City
                      </Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Enter your city"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        className="bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="state" className="text-gray-900 dark:text-white mb-2 block">
                        State/Province
                      </Label>
                      <Input
                        id="state"
                        type="text"
                        placeholder="Enter your state"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        className="bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="postalCode" className="text-gray-900 dark:text-white mb-2 block">
                        Postal Code
                      </Label>
                      <Input
                        id="postalCode"
                        type="text"
                        placeholder="10001"
                        value={address.postalCode}
                        onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                        className="bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="country" className="text-gray-900 dark:text-white mb-2 block">
                        Country
                      </Label>
                      <Select
                        value={address.country}
                        onValueChange={(value) => setAddress({ ...address, country: value })}
                      >
                        <SelectTrigger className="bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.name}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* POA Document Upload */}
                <div className="mb-6">
                  <Label className="text-gray-900 dark:text-white mb-2 block">
                    Upload Proof of Address
                  </Label>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    Accepted documents: Utility Bill, Bank Statement, Government Letter (dated within last 3 months)
                  </p>

                  <input
                    type="file"
                    ref={poaInputRef}
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePOAUpload(file);
                    }}
                    className="hidden"
                  />

                  <div
                    onClick={() => poaInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                      poaDocument
                        ? "border-green-500 bg-green-500/10"
                        : "border-gray-400 dark:border-gray-600 hover:border-[#d4af37] bg-gray-100 dark:bg-gray-800/30"
                    }`}
                  >
                    {poaDocument ? (
                      <div>
                        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-green-500 font-medium">Document uploaded successfully</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{poaDocumentName}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Click to change</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-900 dark:text-white font-medium mb-2">Click to upload POA document</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">JPG, PNG, or PDF, max 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("selfie")}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep("review")}
                    disabled={!address.street || !address.city || !address.state || !address.postalCode || !address.country || !poaDocument}
                    className="flex-1 bg-[#d4af37] hover:bg-[#c4a137] text-black"
                  >
                    Review Submission
                  </Button>
                </div>
              </div>
            )}

            {/* Step 7: Review */}
            {currentStep === "review" && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Review Your Submission</h2>

                <div className="space-y-4 mb-8">
                  <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                    <Label className="text-gray-600 dark:text-gray-400 text-sm">Country</Label>
                    <p className="text-gray-900 dark:text-white font-medium">{selectedCountry?.name}</p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                    <Label className="text-gray-600 dark:text-gray-400 text-sm">ID Type</Label>
                    <p className="text-gray-900 dark:text-white font-medium">{selectedIDType}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-600 dark:text-gray-400 text-sm block mb-2">Front</Label>
                      <img src={frontImage!} alt="Front" className="w-full rounded-lg border border-gray-300 dark:border-gray-700" />
                    </div>
                    <div>
                      <Label className="text-gray-600 dark:text-gray-400 text-sm block mb-2">Back</Label>
                      <img src={backImage!} alt="Back" className="w-full rounded-lg border border-gray-300 dark:border-gray-700" />
                    </div>
                    <div>
                      <Label className="text-gray-600 dark:text-gray-400 text-sm block mb-2">Selfie</Label>
                      <img src={selfieImage!} alt="Selfie" className="w-full rounded-full border border-gray-300 dark:border-gray-700" />
                    </div>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                    <Label className="text-gray-600 dark:text-gray-400 text-sm mb-2 block flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Residential Address
                    </Label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {address.street}<br />
                      {address.city}, {address.state} {address.postalCode}<br />
                      {address.country}
                    </p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg">
                    <Label className="text-gray-600 dark:text-gray-400 text-sm">Proof of Address Document</Label>
                    <p className="text-gray-900 dark:text-white font-medium flex items-center gap-2 mt-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      {poaDocumentName}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("poa")}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 bg-[#d4af37] hover:bg-[#c4a137] text-black font-bold"
                  >
                    Submit Verification
                  </Button>
                </div>
              </div>
            )}

            {/* Step 8: Submitted */}
            {currentStep === "submitted" && (
              <div className="text-center py-12">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Verification Submitted Successfully!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Your documents have been submitted for review.
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Our team will review your submission and verify your account shortly. You'll receive a notification once your account has been verified.
                </p>
                <Button
                  onClick={() => navigate("/profile")}
                  className="bg-[#d4af37] hover:bg-[#c4a137] text-black px-8"
                >
                  Close
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phone Verification Required Dialog */}
      <Dialog open={showPhoneRequiredDialog} onOpenChange={(open) => {
        if (!open) {
          // If user closes dialog without verifying, redirect to profile
          navigate("/profile");
        }
        setShowPhoneRequiredDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Phone Verification Required</DialogTitle>
            <DialogDescription>
              You must verify your phone number before you can proceed with identity verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-900 dark:text-orange-100">
                Please verify your phone number first. This is a mandatory requirement for identity verification.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPhoneRequiredDialog(false);
                  navigate("/profile");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowPhoneRequiredDialog(false);
                  navigate("/profile");
                }}
                className="flex-1"
              >
                Go to Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
