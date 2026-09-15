/**
 * UnsupportedBrowser — экран для браузеров без поддержки WebRTC.
 */
function UnsupportedBrowser() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 px-4 text-center text-white">
      <h1 className="text-2xl font-semibold">Браузер не поддерживается</h1>
      <p className="max-w-md text-gray-300">
        Ваш браузер не поддерживает WebRTC, необходимый для видеозвонка.
        Пожалуйста, используйте актуальную версию Chrome, Firefox или Edge.
      </p>
    </div>
  );
}

export default UnsupportedBrowser;
