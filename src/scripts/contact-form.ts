/** Formulaire de contact : envoi en fetch vers l'endpoint configuré (src/config/site.ts). */
export function initContactForm(): () => void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return () => {};

  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const label = button?.querySelector<HTMLElement>('span');
  const idle = label?.textContent ?? '';

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get('botcheck')) return; // piège à robots (champ caché rempli)
    if (button) button.disabled = true;
    if (label) label.textContent = form.dataset.sending ?? idle;
    if (status) status.textContent = '';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      if (status) {
        status.textContent = form.dataset.success ?? '';
        status.dataset.state = 'success';
      }
    } catch {
      if (status) {
        status.textContent = form.dataset.error ?? '';
        status.dataset.state = 'error';
      }
    } finally {
      if (button) button.disabled = false;
      if (label) label.textContent = idle;
    }
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
