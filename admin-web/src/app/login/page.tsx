import { continueAsAdmin } from './actions';

export default function LoginPage() {
  return (
    <div className='bg-background flex min-h-svh items-center justify-center p-4'>
      <div className='bg-card text-card-foreground w-full max-w-sm space-y-6 rounded-lg border p-8 shadow-sm'>
        <div className='space-y-1 text-center'>
          <h1 className='text-xl font-semibold'>VHSND Supervisor Dashboard</h1>
          <p className='text-muted-foreground text-sm'>
            Pilot demo — not connected to live government infrastructure.
          </p>
        </div>
        <form action={continueAsAdmin}>
          <button
            type='submit'
            className='bg-primary text-primary-foreground w-full rounded-md px-4 py-2.5 text-sm font-medium hover:opacity-90'
          >
            Continue as Dilip Acharya (Chief Medical Officer)
          </button>
        </form>
      </div>
    </div>
  );
}
