var AuthKey;
AuthKey = $.cookie("AuthKey");

if (AuthKey)
	ServerQueryAppendKey("AuthKey",AuthKey);

