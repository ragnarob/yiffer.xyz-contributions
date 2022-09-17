type InfoBoxProps = {
  variant: 'info' | 'success' | 'error';
  text?: string;
  title?: string;
  showIcon?: Boolean; // TODO implement
  children?: React.ReactNode;
  className?: string;
};

export default function InfoBox({
  variant = 'info',
  title,
  text,
  showIcon = false,
  children,
  className = '',
  ...props
}: InfoBoxProps) {
  let variantClassname = '';

  if (variant === 'info') {
    variantClassname = 'from-status-info1 to-status-info2 ';
  }
  if (variant === 'error') {
    variantClassname = 'from-status-error1 to-status-error2 font-semibold ';
  }
  if (variant === 'success') {
    variantClassname = 'from-theme1-dark to-theme2-dark font-semibold ';
  }

  const fullClassname = `p-4 flex flex-col rounded shadow-md bg-gradient-to-r text-white ${variantClassname} ${className}`;

  return (
    <div className={fullClassname} {...props}>
      {title ? <p className="text-xl">{title}</p> : undefined}
      {text ? <p>{text}</p> : undefined}
      {children}
    </div>
  );
}