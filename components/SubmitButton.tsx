'use client';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonVariant } from '@/components/ui';

export function SubmitButton({ children, pendingText, variant = 'primary', size = 'md', className, confirm }: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText ?? 'Please wait…' : children}
    </Button>
  );
}
