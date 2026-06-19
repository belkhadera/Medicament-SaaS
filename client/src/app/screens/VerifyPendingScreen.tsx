import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../components/useAuth';

interface VerifyPendingScreenProps {
  email: string;
  onBackToLogin: () => void;
}

export function VerifyPendingScreen({ email, onBackToLogin }: VerifyPendingScreenProps) {
  const { resendVerification } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setIsLoading(true);
    try {
      const message = await resendVerification(email);
      setNotice(message);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible de renvoyer l\'e-mail de vérification.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-lg border border-border p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-xl mb-4">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Vérifiez votre e-mail</h1>
          <p className="text-muted-foreground mb-1">Nous avons envoyé un lien de vérification à</p>
          <p className="text-foreground font-medium mb-6 break-all">{email}</p>
          <p className="text-sm text-muted-foreground mb-6">
            Cliquez sur le lien dans cet e-mail pour activer votre compte. Vous devez vérifier votre
            e-mail avant de pouvoir vous connecter.
          </p>

          {notice && (
            <div className="mb-4 p-3 bg-success/10 border border-success/20 text-success text-sm rounded-lg">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Envoi…' : 'Renvoyer l\'e-mail de vérification'}
            </button>
            <button
              onClick={onBackToLogin}
              className="w-full border border-border py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
