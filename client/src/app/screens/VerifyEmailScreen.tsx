import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../components/useAuth';

interface VerifyEmailScreenProps {
  token: string;
  onBackToLogin: () => void;
}

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailScreen({ token, onBackToLogin }: VerifyEmailScreenProps) {
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  // Guard against double-invocation (React 18 StrictMode mounts effects twice).
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        await verifyEmail(token);
        // On success the user becomes authenticated and App swaps to the
        // dashboard; this success state is a brief fallback.
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
            err.response?.data?.error ||
            'Ce lien de vérification est invalide ou a expiré.',
        );
      }
    })();
  }, [token, verifyEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-lg border border-border p-8 text-center">
          {status === 'verifying' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-xl mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">Vérification de votre e-mail…</h1>
              <p className="text-muted-foreground">Un instant, cela ne prend qu'un moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-xl mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">E-mail vérifié !</h1>
              <p className="text-muted-foreground">Redirection vers votre tableau de bord…</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-xl mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">Échec de la vérification</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={onBackToLogin}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
