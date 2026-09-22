let chatIsOpen = false;

export const setChatOpen = (open: boolean) => {
  chatIsOpen = open;
};

export const isChatOpen = () => chatIsOpen;
