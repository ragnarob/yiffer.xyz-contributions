import clsx from 'clsx';

const gradientClasses = `before:h-2.5 before:w-full before:absolute before:-top-1 before:left-0 before:content-['']
   before:bg-gradient-to-r before:from-theme1 before:to-theme2 bg-white dark:bg-gray-200`;

export default function TopGradientBox({ children, className = '' }) {
  return <div className={clsx(gradientClasses, className)}>{children}</div>;
}
