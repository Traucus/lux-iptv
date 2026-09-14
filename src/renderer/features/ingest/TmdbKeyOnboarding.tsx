import React, { useState } from 'react';
import { PasswordField } from '../../components/atoms/PasswordField';
import { Button } from '../../components/atoms/Button';
import { useSetTmdbKey, useTmdbKey } from '../../queries/use-tmdb-key';
import { TmdbKeyInputSchema } from '../../../shared/schemas/tmdb';

/**
 * Required TMDB key slot on S2. Play still works without it; empty art is not the product look.
 */
export function TmdbKeyOnboarding(): React.ReactElement | null {
  const { data: hasKey, isPending } = useTmdbKey();
  const setKey = useSetTmdbKey();
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return null;
  }

  if (hasKey) {
    return (
      <section className="flex flex-col gap-2 pt-6 border-t border-white/10" data-testid="tmdb-key-configured">
        <h2 className="text-lg font-semibold text-white">TMDB metadata</h2>
        <p className="text-gray-400 text-sm">API key saved. The key is never shown.</p>
      </section>
    );
  }

  const handleSave = (): void => {
    const parsed = TmdbKeyInputSchema.safeParse({ key: value.trim() });
    if (!parsed.success) {
      setError('Enter a valid TMDB API key.');
      return;
    }
    setError(null);
    setKey.mutate(parsed.data, {
      onSuccess: (data) => {
        if (!data.valid) {
          setError('That key was rejected by TMDB.');
        } else {
          setValue('');
        }
      },
      onError: () => {
        setError('Could not save the TMDB key.');
      },
    });
  };

  return (
    <section className="flex flex-col gap-4 pt-6 border-t border-white/10" data-testid="tmdb-key-onboarding">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-white">TMDB API key (required)</h2>
        <p className="text-gray-400 text-sm">
          Posters and synopses need this key. Playback still works without it.
        </p>
      </div>
      <PasswordField
        id="tmdb-api-key"
        label="TMDB API key"
        value={value}
        onChange={(next) => {
          setValue(next);
          setError(null);
        }}
        required
        error={error}
        visible={visible}
        onToggleVisible={() => setVisible((current) => !current)}
        showLabel="Show TMDB key"
        hideLabel="Hide TMDB key"
        autoComplete="off"
        disabled={setKey.isPending}
      />
      <Button type="button" onClick={handleSave} disabled={setKey.isPending || value.trim().length === 0}>
        Save TMDB key
      </Button>
    </section>
  );
}

export default TmdbKeyOnboarding;
