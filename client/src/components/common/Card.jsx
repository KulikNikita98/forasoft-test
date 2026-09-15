/**
 * Card — переиспользуемый контейнер-карточка.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} props.className
 */
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-gray-800 p-8 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

export default Card;
