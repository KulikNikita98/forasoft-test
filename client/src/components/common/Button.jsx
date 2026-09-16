/**
 * Button — переиспользуемый компонент кнопки с вариантами стилей.
 *
 * @param {object} props
 * @param {'primary' | 'secondary' | 'danger'} props.variant
 * @param {boolean} props.disabled
 * @param {boolean} props.fullWidth
 * @param {() => void} props.onClick
 * @param {string} [props.className] — дополнительные классы (добавляются к базовым)
 * @param {React.ReactNode} props.children
 */
function Button({
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  onClick,
  children,
  type = 'button',
  className = '',
  ...rest
}) {
  const baseClasses = 'rounded-lg px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-700 text-white hover:bg-gray-600',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };

  const widthClass = fullWidth ? 'w-full' : '';

  // className из props добавляется к внутренним классам, а не перезаписывает их.
  // filter(Boolean) убирает пустые строки, чтобы не было двойных пробелов.
  const classes = [baseClasses, variantClasses[variant], widthClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
