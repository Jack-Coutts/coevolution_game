import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDuration } from '@/sim/time'

/** Asks before a reset throws away a long run (R, the reset button or "Reset to retune"). */
export function ConfirmReset({ open, hours, onCancel, onConfirm }: { open: boolean; hours: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reset this run?</DialogTitle>
          <DialogDescription>
            This meadow has run for {formatDuration(hours)}. Resetting starts again on 1 September with the same seed and
            settings, and this run and its replay are lost. Save first if you want to come back to it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} autoFocus>
            Keep this run
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
