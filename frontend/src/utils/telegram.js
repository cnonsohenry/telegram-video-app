export const tg = window.Telegram?.WebApp;

export const expandApp = () => {
  tg?.expand();
};

export const hapticLight = () => {
  tg?.HapticFeedback?.impactOccurred("light");
};

export const showMainButton = (text, onClick) => {
  if (!tg) return;
  tg.MainButton.setText(text);
  tg.MainButton.show();
  tg.MainButton.onClick(onClick);
};

export const hideMainButton = () => {
  tg?.MainButton.hide();
};

export const showBackButton = (onClick) => {
  tg?.BackButton.show();
  tg?.BackButton.onClick(onClick);
};
