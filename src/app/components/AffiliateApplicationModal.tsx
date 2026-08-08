import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AlertCircle, CheckCircle2, Upload, X } from "lucide-react";

const PLATFORMS = [
  { value: "facebook",  label: "Facebook (Page / Group)" },
  { value: "x",         label: "X.com (Twitter)" },
  { value: "telegram",  label: "Telegram (Channel / Group)" },
  { value: "whatsapp",  label: "WhatsApp Community" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube",   label: "YouTube" },
  { value: "tiktok",    label: "TikTok" },
  { value: "discord",   label: "Discord" },
] as const;

export interface AffiliateApplicationData {
  fullName:          string;
  socialPlatform:    string;
  socialLink:        string;
  socialUsername:    string;
  totalMembers:      number;
  screenshotDataUrl: string | undefined;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  onSubmit: (data: AffiliateApplicationData) => void;
}

export function AffiliateApplicationModal({ open, onClose, onSubmit }: Props) {
  const [fullName,       setFullName]       = useState("");
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialLink,     setSocialLink]     = useState("");
  const [socialUsername, setSocialUsername] = useState("");
  const [totalMembers,   setTotalMembers]   = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | undefined>(undefined);
  const [screenshotName, setScreenshotName] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFullName(""); setSocialPlatform(""); setSocialLink("");
    setSocialUsername(""); setTotalMembers(""); setScreenshotDataUrl(undefined);
    setScreenshotName(""); setErrors({}); setSubmitting(false);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, screenshot: "Screenshot must be under 5 MB" }));
      return;
    }
    setScreenshotName(file.name);
    setErrors(prev => { const { screenshot: _, ...rest } = prev; return rest; });
    const reader = new FileReader();
    reader.onload = ev => setScreenshotDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshotDataUrl(undefined);
    setScreenshotName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2)
      errs.fullName = "Full name must be at least 2 characters";
    if (!socialPlatform)
      errs.socialPlatform = "Select a platform";
    if (!socialLink.trim()) {
      errs.socialLink = "Social media link is required";
    } else {
      try { new URL(socialLink.trim()); }
      catch { errs.socialLink = "Enter a valid URL (include https://)"; }
    }
    if (!socialUsername.trim())
      errs.socialUsername = "Username / page / channel name is required";
    const members = parseInt(totalMembers);
    if (!totalMembers || isNaN(members) || members < 1000)
      errs.totalMembers = "Minimum 1,000 members/followers required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        fullName:          fullName.trim(),
        socialPlatform,
        socialLink:        socialLink.trim(),
        socialUsername:    socialUsername.trim(),
        totalMembers:      parseInt(totalMembers),
        screenshotDataUrl,
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Affiliate Application</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Applications are reviewed manually within 24–48 hours.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-gray-900 dark:text-white text-sm">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your legal full name"
              className={`bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white ${errors.fullName ? "border-red-500" : ""}`}
            />
            {errors.fullName && <FieldError msg={errors.fullName} />}
          </div>

          {/* Platform */}
          <div className="space-y-1.5">
            <Label className="text-gray-900 dark:text-white text-sm">Social Media Platform</Label>
            <Select value={socialPlatform} onValueChange={setSocialPlatform}>
              <SelectTrigger className={`bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white ${errors.socialPlatform ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700">
                {PLATFORMS.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-gray-900 dark:text-white">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.socialPlatform && <FieldError msg={errors.socialPlatform} />}
          </div>

          {/* Social Media Link */}
          <div className="space-y-1.5">
            <Label htmlFor="socialLink" className="text-gray-900 dark:text-white text-sm">
              Link to Your Page / Channel / Group
            </Label>
            <Input
              id="socialLink"
              type="url"
              value={socialLink}
              onChange={e => setSocialLink(e.target.value)}
              placeholder="https://..."
              className={`bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white ${errors.socialLink ? "border-red-500" : ""}`}
            />
            {errors.socialLink && <FieldError msg={errors.socialLink} />}
          </div>

          {/* Social Username */}
          <div className="space-y-1.5">
            <Label htmlFor="socialUsername" className="text-gray-900 dark:text-white text-sm">
              Username / Page / Channel Name
            </Label>
            <Input
              id="socialUsername"
              value={socialUsername}
              onChange={e => setSocialUsername(e.target.value)}
              placeholder="e.g. @mypage or My Telegram Group"
              className={`bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white ${errors.socialUsername ? "border-red-500" : ""}`}
            />
            {errors.socialUsername && <FieldError msg={errors.socialUsername} />}
          </div>

          {/* Total Members */}
          <div className="space-y-1.5">
            <Label htmlFor="totalMembers" className="text-gray-900 dark:text-white text-sm">
              Total Followers / Members
            </Label>
            <Input
              id="totalMembers"
              type="number"
              min={1000}
              value={totalMembers}
              onChange={e => setTotalMembers(e.target.value)}
              placeholder="Minimum 1,000"
              className={`bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white ${errors.totalMembers ? "border-red-500" : ""}`}
            />
            {errors.totalMembers && <FieldError msg={errors.totalMembers} />}
            {!errors.totalMembers && totalMembers && parseInt(totalMembers) >= 1000 && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Meets minimum requirement
              </p>
            )}
          </div>

          {/* Ownership Screenshot */}
          <div className="space-y-1.5">
            <Label className="text-gray-900 dark:text-white text-sm">
              Ownership Screenshot{" "}
              <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">(optional but recommended)</span>
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Show that you own or manage the account — e.g. admin panel, analytics, or settings page showing your name.
            </p>
            {screenshotDataUrl ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs text-green-700 dark:text-green-400 flex-1 truncate">{screenshotName}</span>
                <button type="button" onClick={removeScreenshot} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload screenshot (JPG, PNG — max 5 MB)
              </button>
            )}
            {errors.screenshot && <FieldError msg={errors.screenshot} />}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleScreenshotChange}
            />
          </div>

          {/* Manual review notice */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Our team will manually verify your social media account and audience size. You will receive a notification within 24–48 hours.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-900 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {msg}
    </p>
  );
}
