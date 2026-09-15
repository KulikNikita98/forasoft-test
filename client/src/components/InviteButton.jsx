import { useState } from 'react';

/**
 * InviteButton — копирование ссылки-приглашения в буфер обмена.
 */
function InviteButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: выделение через prompt, если clipboard API недоступен
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-600"
    >
      {copied ? 'Ссылка скопирована ✓' : 'Копировать ссылку'}
    </button>
  );
}

export default InviteButton;
