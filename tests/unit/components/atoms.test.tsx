/**
 * Atom component tests.
 *
 * We render presentational components to HTML via react-dom/server.renderToString
 * and assert on the rendered markup. This avoids needing jsdom or testing-library
 * while still covering rendering and key props.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../../../src/renderer/components/atoms/Button.tsx';
import { Input } from '../../../src/renderer/components/atoms/Input.tsx';
import { TextField } from '../../../src/renderer/components/atoms/TextField.tsx';
import { PasswordField } from '../../../src/renderer/components/atoms/PasswordField.tsx';
import { IconButton } from '../../../src/renderer/components/atoms/IconButton.tsx';
import { Spinner } from '../../../src/renderer/components/atoms/Spinner.tsx';
import { Badge } from '../../../src/renderer/components/atoms/Badge.tsx';
import { ProgressBar } from '../../../src/renderer/components/atoms/ProgressBar.tsx';

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe('atoms', () => {
  describe('Button', () => {
    it('renders primary variant by default', () => {
      const html = render(<Button>Click</Button>);
      expect(html).toContain('Click');
      expect(html).toContain('bg-primary-500');
    });

    it('renders glass variant', () => {
      const html = render(<Button variant="glass">Glass</Button>);
      expect(html).toContain('bg-glass');
    });

    it('renders loading state with spinner and aria-busy', () => {
      const html = render(<Button loading>Loading</Button>);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('animate-spin');
    });

    it('accepts className extension', () => {
      const html = render(<Button className="custom-class">x</Button>);
      expect(html).toContain('custom-class');
    });

    it('renders danger variant', () => {
      const html = render(<Button variant="danger">Delete</Button>);
      expect(html).toContain('bg-red-600');
    });
  });

  describe('Input', () => {
    it('renders with value', () => {
      const html = render(<Input value="hello" onChange={() => undefined} />);
      expect(html).toContain('value="hello"');
    });

    it('shows invalid state', () => {
      const html = render(<Input invalid value="" onChange={() => undefined} />);
      expect(html).toContain('border-red-500');
      expect(html).toContain('aria-invalid="true"');
    });

    it('accepts className', () => {
      const html = render(<Input className="my-input" value="" onChange={() => undefined} />);
      expect(html).toContain('my-input');
    });
  });

  describe('TextField', () => {
    it('renders label and input with linked id', () => {
      const html = render(
        <TextField id="username" label="Username" value="" onChange={() => undefined} />,
      );
      expect(html).toContain('Username');
      expect(html).toContain('id="username"');
      expect(html).toContain('for="username"');
    });

    it('renders required indicator', () => {
      const html = render(
        <TextField label="Email" value="" onChange={() => undefined} required />,
      );
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('*');
    });

    it('renders error message with role="alert"', () => {
      const html = render(
        <TextField label="Email" value="" onChange={() => undefined} error="Required field" />,
      );
      expect(html).toContain('Required field');
      expect(html).toContain('role="alert"');
    });
  });

  describe('PasswordField', () => {
    it('renders as password type by default', () => {
      const html = render(
        <PasswordField label="Password" value="secret" onChange={() => undefined} />,
      );
      expect(html).toContain('type="password"');
    });

    it('renders as text type when visible', () => {
      const html = render(
        <PasswordField
          label="Password"
          value="secret"
          onChange={() => undefined}
          visible
          onToggleVisible={() => undefined}
        />,
      );
      expect(html).toContain('type="text"');
      expect(html).toContain('Hide password');
    });

    it('renders show toggle when handler provided', () => {
      const html = render(
        <PasswordField
          label="Password"
          value="x"
          onChange={() => undefined}
          onToggleVisible={() => undefined}
        />,
      );
      expect(html).toContain('Show password');
    });
  });

  describe('IconButton', () => {
    it('renders with required aria-label', () => {
      const html = render(
        <IconButton aria-label="Play">
          <span>P</span>
        </IconButton>,
      );
      expect(html).toContain('aria-label="Play"');
      expect(html).toContain('<span>P</span>');
    });

    it('renders different sizes', () => {
      const sm = render(
        <IconButton aria-label="X" size="sm">
          x
        </IconButton>,
      );
      const lg = render(
        <IconButton aria-label="X" size="lg">
          x
        </IconButton>,
      );
      expect(sm).toContain('w-8');
      expect(lg).toContain('w-12');
    });
  });

  describe('Spinner', () => {
    it('renders with role="status"', () => {
      const html = render(<Spinner />);
      expect(html).toContain('role="status"');
      expect(html).toContain('animate-spin');
    });

    it('uses custom label', () => {
      const html = render(<Spinner label="Loading movies" />);
      expect(html).toContain('aria-label="Loading movies"');
    });
  });

  describe('Badge', () => {
    it('renders default variant', () => {
      const html = render(<Badge>New</Badge>);
      expect(html).toContain('New');
    });

    it('renders success variant', () => {
      const html = render(<Badge variant="success">Active</Badge>);
      expect(html).toContain('bg-emerald-500/20');
    });
  });

  describe('ProgressBar', () => {
    it('renders with progressbar role and value', () => {
      const html = render(<ProgressBar value={42} label="Loading" />);
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="42"');
    });

    it('shows percent when requested', () => {
      const html = render(<ProgressBar value={33} showPercent />);
      expect(html).toContain('33%');
    });

    it('clamps value to 0-100 range', () => {
      const high = render(<ProgressBar value={200} />);
      const low = render(<ProgressBar value={-50} />);
      expect(high).toContain('width:100%');
      expect(low).toContain('width:0%');
    });
  });
});
