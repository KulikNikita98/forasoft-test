/**
 * Input — переиспользуемый компонент текстового поля.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} props.value
 * @param {string} props.placeholder
 * @param {string} props.error
 * @param {number} props.maxLength
 * @param {(e: Event) => void} props.onChange
 * @param {(e: KeyboardEvent) => void} props.onKeyDown
 * @param {boolean} props.autoFocus
 */
function Input({
  id,
  label,
  value,
  placeholder,
  error,
  maxLength,
  onChange,
  onKeyDown,
  autoFocus = false,
  type = 'text',
  ...rest
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mb-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        {...rest}
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default Input;
