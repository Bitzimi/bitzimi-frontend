import { Shield } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";

interface AgeVerificationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export function AgeVerificationModal({ isOpen, onConfirm, onReject }: AgeVerificationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onReject}
          />

          {/* Modal - Desktop: 60% larger (max-w-md -> max-w-2xl) */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl max-w-md sm:max-w-2xl w-full border border-gray-200 dark:border-gray-800"
            >
              <div className="p-8 sm:p-12 flex flex-col items-center text-center space-y-6 sm:space-y-10">
                {/* Icon */}
                <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Shield className="h-10 w-10 sm:h-16 sm:w-16 text-white" />
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">Age Restricted</h2>
                  <p className="text-lg sm:text-2xl font-semibold text-orange-600 dark:text-orange-400">18+ Only</p>
                </div>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm sm:max-w-lg text-base sm:text-lg">
                  You must be at least 18 years old to access gaming features on this platform.
                </p>

                {/* Buttons */}
                <div className="flex gap-3 sm:gap-4 w-full pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 sm:h-16 text-base sm:text-lg font-medium"
                    onClick={onReject}
                  >
                    Exit
                  </Button>
                  <Button
                    className="flex-1 h-12 sm:h-16 text-base sm:text-lg font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    onClick={onConfirm}
                  >
                    Continue (18+)
                  </Button>
                </div>

                {/* Footer note */}
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 pt-2">
                  By continuing, you confirm you meet the age requirement
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}