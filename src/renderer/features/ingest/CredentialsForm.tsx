import React, { useState } from 'react';
import { TextField } from '../../components/atoms/TextField';
import { PasswordField } from '../../components/atoms/PasswordField';
import { Input } from '../../components/atoms/Input';
import { Button } from '../../components/atoms/Button';
import { CredentialFormTabs, type CredentialSource } from '../../components/molecules/CredentialFormTabs';

export interface CredentialsFormValue {
  source: CredentialSource;
  server?: string;
  username?: string;
  password?: string;
  listName: string;
  url?: string;
}

export interface CredentialsFormProps {
  source: CredentialSource;
  onSourceChange: (source: CredentialSource) => void;
  value: CredentialsFormValue;
  onChange: (next: CredentialsFormValue) => void;
  onSubmit: () => void;
  submitting?: boolean;
  className?: string;
}

const URL_PATTERN = /^https?:\/\/.+/i;

export function validateCredentials(value: CredentialsFormValue): { [field: string]: string } {
  const errors: { [field: string]: string } = {};

  if (!value.listName.trim()) {
    errors.listName = 'List name is required';
  }

  if (value.source === 'xtream') {
    if (!value.server || !URL_PATTERN.test(value.server)) {
      errors.server = 'URL must start with http:// or https://';
    }
    if (!value.username?.trim()) {
      errors.username = 'Username is required';
    }
    if (!value.password) {
      errors.password = 'Password is required';
    }
  } else if (value.source === 'm3u') {
    if (!value.url || !URL_PATTERN.test(value.url)) {
      errors.url = 'URL must start with http:// or https://';
    }
  }

  return errors;
}

export function CredentialsForm({
  source,
  onSourceChange,
  value,
  onChange,
  onSubmit,
  submitting = false,
  className = '',
}: CredentialsFormProps): React.ReactElement {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [localFile, setLocalFile] = useState<string>('');

  const errors = validateCredentials(value);
  const hasErrors = Object.keys(errors).length > 0;

  const showError = (field: string): string | null => {
    if (!touched[field]) return null;
    return errors[field] ?? null;
  };

  const markAllTouched = (): void => {
    setTouched({ listName: true, server: true, username: true, password: true, url: true });
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (hasErrors || submitting) {
      markAllTouched();
      return;
    }
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="credentials-form-title"
      className={`flex flex-col gap-6 w-full max-w-xl ${className}`}
    >
      <h2 id="credentials-form-title" className="sr-only">Credentials</h2>

      <CredentialFormTabs active={source} onChange={onSourceChange} />

      {source === 'xtream' ? (
        <div className="flex flex-col gap-4">
          <TextField
            id="cf-server"
            label="Server URL"
            value={value.server ?? ''}
            onChange={(v) => {
              onChange({ ...value, server: v });
              setTouched((t) => ({ ...t, server: true }));
            }}
            placeholder="http://example.com:8080"
            type="url"
            required
            error={showError('server')}
            autoComplete="url"
          />
          <TextField
            id="cf-username"
            label="Username"
            value={value.username ?? ''}
            onChange={(v) => {
              onChange({ ...value, username: v });
              setTouched((t) => ({ ...t, username: true }));
            }}
            placeholder="user123"
            required
            error={showError('username')}
            autoComplete="username"
          />
          <PasswordField
            id="cf-password"
            label="Password"
            value={value.password ?? ''}
            onChange={(v) => {
              onChange({ ...value, password: v });
              setTouched((t) => ({ ...t, password: true }));
            }}
            placeholder="••••••••"
            required
            error={showError('password')}
            visible={passwordVisible}
            onToggleVisible={() => setPasswordVisible((v) => !v)}
          />
        </div>
      ) : null}

      {source === 'm3u' ? (
        <div className="flex flex-col gap-4">
          <TextField
            id="cf-url"
            label="M3U Playlist URL"
            value={value.url ?? ''}
            onChange={(v) => {
              onChange({ ...value, url: v });
              setTouched((t) => ({ ...t, url: true }));
            }}
            placeholder="https://example.com/playlist.m3u"
            type="url"
            required
            error={showError('url')}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-200">Or load local file</label>
            <div className="flex gap-2 items-center">
              <Input
                value={localFile}
                onChange={(e) => {
                  setLocalFile(e.target.value);
                  onChange({ ...value, url: e.target.value ? `file://${e.target.value}` : '' });
                }}
                placeholder="/path/to/playlist.m3u"
              />
              <Button
                type="button"
                variant="glass"
                onClick={() => {
                  // Browser file picker is mocked in tests
                  setLocalFile('/mocked/playlist.m3u');
                  onChange({ ...value, url: 'file:///mocked/playlist.m3u' });
                }}
              >
                Browse
              </Button>
            </div>
            <p className="text-xs text-gray-500">File must be inside the userData directory.</p>
          </div>
        </div>
      ) : null}

      <TextField
        id="cf-listname"
        label="List Name"
        value={value.listName}
        onChange={(v) => {
          onChange({ ...value, listName: v });
          setTouched((t) => ({ ...t, listName: true }));
        }}
        placeholder="My IPTV"
        required
        error={showError('listName')}
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={hasErrors && Object.values(touched).some(Boolean)}
          loading={submitting}
        >
          Start Ingestion
        </Button>
      </div>
    </form>
  );
}

export default CredentialsForm;
