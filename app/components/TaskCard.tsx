import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Task } from "../types/tasks";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const { formatCurrency, convertFromUSD } = useSettings();
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [proofUrl, setProofUrl] = useState("");

  const handleSubmitProof = () => {
    // URL-based submission is not verified by the backend.
    // Please use the Task Marketplace page which uses the full screenshot-based
    // AI verification flow (POST /api/v1/tasks/:id/proofs).
    toast.info("Please submit this task from the Task Marketplace for proper verification and reward processing.");
    setShowDetailDialog(false);
    setProofUrl("");
  };

  const budgetRemaining = task.totalBudget - task.budgetUsed;
  const budgetPercentage = (task.budgetUsed / task.totalBudget) * 100;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-40 overflow-hidden">
        <img 
          src={task.imageUrl} 
          alt={task.title}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-1">{task.title}</CardTitle>
          <Badge variant={task.status === "active" ? "default" : "secondary"}>
            {task.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 line-clamp-2">{task.shortDescription}</p>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Reward</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(task.rewardPerUser)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Remaining</p>
            <p className="text-sm font-medium">{task.remainingSlots} spots</p>
          </div>
        </div>

        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogTrigger asChild>
            <Button className="w-full h-11">
              Start Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{task.title}</DialogTitle>
              <DialogDescription>
                Complete this task to earn {formatCurrency(task.rewardPerUser)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="h-48 rounded-lg overflow-hidden">
                <img 
                  src={task.imageUrl} 
                  alt={task.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-gray-600">{task.description}</p>
              </div>

              {task.extraInstructions && (
                <div>
                  <h4 className="font-medium mb-2">Extra Instructions</h4>
                  <p className="text-sm text-gray-600">{task.extraInstructions}</p>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Task Budget</span>
                  <span className="text-sm font-medium">{formatCurrency(budgetRemaining)} / {formatCurrency(task.totalBudget)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${budgetPercentage}%` }}
                  />
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-11"
                onClick={() => window.open(task.taskLink, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Task Link
              </Button>

              <div className="space-y-2">
                <Label htmlFor="proof">Submit Proof (URL or Screenshot link)</Label>
                <Textarea
                  id="proof"
                  placeholder="Paste your proof URL here (e.g., screenshot link, social media post URL)"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  rows={3}
                />
              </div>

              <Button onClick={handleSubmitProof} className="w-full h-11">
                Submit Proof
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}