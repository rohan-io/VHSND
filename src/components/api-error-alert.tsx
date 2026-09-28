import { Icons } from '@/components/icons';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export function ApiErrorAlert() {
  return (
    <Alert variant='destructive'>
      <Icons.warning />
      <AlertTitle>Could not reach the local API server</AlertTitle>
      <AlertDescription>
        Make sure local-api is running (`npm run dev` in local-api/) at the URL in
        NEXT_PUBLIC_API_URL, then refresh.
      </AlertDescription>
    </Alert>
  );
}
