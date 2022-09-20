type TopGradientBoxProps = {
  containerClassName?: string;
  innerClassName?: string;
  children: React.ReactNode;
};

export default function TopGradientBox({
  containerClassName,
  innerClassName,
  children,
}: TopGradientBoxProps) {
  return (
    <div
      className={`pt-2.5 bg-gradient-to-r from-theme1-primary to-theme2-primary shadow-lg ${containerClassName}`}
    >
      <div className={`bg-white dark:bg-gray-300 w-full h-full ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
