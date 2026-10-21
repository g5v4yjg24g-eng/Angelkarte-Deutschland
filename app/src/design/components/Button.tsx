import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  icon,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], block ? styles.block : '', className ?? ''].join(' ')}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

/** Nur-Icon-Button: label ist Pflicht (Screenreader, Tooltip). */
export function IconButton({
  label,
  icon,
  className,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label: string; icon: ReactNode }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[styles.iconButton, className ?? ''].join(' ')}
      {...rest}
    >
      {icon}
    </button>
  );
}
