import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { useSettings, CURRENCIES } from "../contexts/SettingsContext";
import { Moon, Sun, Globe, DollarSign } from "lucide-react";

type SettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme, language, setLanguage, availableLanguages, currency, setCurrency } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "light" ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-blue-500" />
              )}
              <div>
                <Label className="text-base font-medium">Theme</Label>
                <p className="text-sm text-gray-500">
                  {theme === "light" ? "Light Mode" : "Dark Mode"}
                </p>
              </div>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>

          {/* Language Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <Label className="text-base font-medium">Language</Label>
            </div>
            <Select
              value={language.code}
              onValueChange={(code) => {
                const selected = availableLanguages.find((l) => l.code === code);
                if (selected) setLanguage(selected);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <Label className="text-base font-medium">Currency</Label>
            </div>
            <Select
              value={currency.code}
              onValueChange={(code) => {
                const selected = CURRENCIES.find((c) => c.code === code);
                if (selected) setCurrency(selected);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              All balances will be displayed in {currency.code}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
