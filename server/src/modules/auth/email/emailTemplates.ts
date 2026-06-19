/**
 * HTML email templates for the auth flows (clickable-link style).
 * Modelled on the reference emailsTemplate.js, adapted to MediTrack's branding.
 */

const BRAND = 'MediTrack Santé';
const PRIMARY = '#0d9488';
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const BG = '#f3f4f6';

function layout(opts: { heading: string; intro: string; bodyHtml: string; footerNote?: string }): string {
  const { heading, intro, bodyHtml, footerNote } = opts;
  return `
  <div style="margin:0;padding:0;background:${BG};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:14px;background:${PRIMARY};color:#fff;font-size:26px;font-weight:700;">℞</div>
        <div style="margin-top:10px;font-size:18px;font-weight:600;color:${TEXT};">${BRAND}</div>
      </div>
      <div style="background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:${TEXT};">${heading}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${intro}</p>
        ${bodyHtml}
      </div>
      <p style="text-align:center;font-size:12px;color:${MUTED};margin-top:20px;line-height:1.6;">
        ${footerNote ?? `Vous recevez cet e-mail car une action a été demandée pour votre compte ${BRAND}.`}
        <br/>© ${new Date().getFullYear()} ${BRAND}. Tous droits réservés.
      </p>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `
    <div style="text-align:center;margin:8px 0 24px;">
      <a href="${href}" target="_blank"
         style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;
                font-size:15px;font-weight:600;padding:13px 28px;border-radius:10px;">${label}</a>
    </div>
    <p style="font-size:13px;color:${MUTED};line-height:1.6;margin:0 0 4px;">
      Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
    </p>
    <p style="font-size:13px;word-break:break-all;margin:0;">
      <a href="${href}" target="_blank" style="color:${PRIMARY};">${href}</a>
    </p>`;
}

export function VERIFICATION_EMAIL_TEMPLATE(name: string, verifyUrl: string, expiresMinutes: number): string {
  return layout({
    heading: `Bienvenue, ${name} !`,
    intro: `Merci de vous être inscrit sur ${BRAND}. Veuillez confirmer votre adresse e-mail pour activer votre compte.`,
    bodyHtml:
      button(verifyUrl, "Vérifier l'adresse e-mail") +
      `<p style="font-size:13px;color:${MUTED};margin-top:18px;">Ce lien expire dans ${expiresMinutes} minutes. Si vous n'avez pas créé ce compte, vous pouvez ignorer cet e-mail.</p>`,
  });
}

export function WELCOME_EMAIL_TEMPLATE(name: string, loginUrl: string): string {
  return layout({
    heading: `Tout est prêt, ${name} !`,
    intro: `Votre e-mail a été vérifié et votre compte ${BRAND} est désormais actif.`,
    bodyHtml:
      button(loginUrl, 'Accéder au tableau de bord') +
      `<p style="font-size:13px;color:${MUTED};margin-top:18px;">Vous pouvez maintenant gérer l'inventaire, suivre les péremptions, et plus encore.</p>`,
  });
}

export function PASSWORD_RESET_TEMPLATE(name: string, resetUrl: string, expiresMinutes: number): string {
  return layout({
    heading: 'Demande de réinitialisation du mot de passe',
    intro: `Bonjour ${name}, nous avons reçu une demande de réinitialisation du mot de passe de votre compte ${BRAND}.`,
    bodyHtml:
      button(resetUrl, 'Réinitialiser le mot de passe') +
      `<p style="font-size:13px;color:${MUTED};margin-top:18px;">Ce lien expire dans ${expiresMinutes} minutes. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail — votre mot de passe ne changera pas.</p>`,
    footerNote: "Pour votre sécurité, ce lien ne peut être utilisé qu'une seule fois.",
  });
}

export function PASSWORD_RESET_SUCCESS_TEMPLATE(name: string, loginUrl: string): string {
  return layout({
    heading: 'Mot de passe mis à jour',
    intro: `Bonjour ${name}, ceci confirme que le mot de passe de votre compte ${BRAND} vient d'être modifié.`,
    bodyHtml:
      button(loginUrl, 'Se connecter') +
      `<p style="font-size:13px;color:${MUTED};margin-top:18px;">Si vous n'êtes pas à l'origine de ce changement, réinitialisez immédiatement votre mot de passe et contactez le support.</p>`,
  });
}
