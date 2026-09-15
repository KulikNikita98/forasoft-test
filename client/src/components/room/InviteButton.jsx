import { useState } from 'react';
import { Button } from '../common/index.js';

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
      // Fallback: можно добавить альтернативный метод через prompt
      setCopied(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleCopy}>
      {copied ? 'Ссылка скопирована ✓' : 'Копировать ссылку'}
    </Button>
  );
}

export default InviteButton;
