/* for a simple request on the server (usually used with PlainList=True ); gets the responseText and returns an array, splitting it via the newline character */
function loadSimpleRequest(dname)
{
	if (window.XMLHttpRequest)
		xhttp=new XMLHttpRequest();
	else
		xhttp=new ActiveXObject("Microsoft.XMLHTTP");
	  
	xhttp.open("GET",dname,false);
	xhttp.send();

	return xhttp.responseText.split("\n");
}

/* build a server queue */
BuildServerQuery.keys = new Object();
function BuildServerQuery()
{
	staticKeys = new Array(); 
	for(var key in BuildServerQuery.keys) 
		staticKeys.push(key+"="+BuildServerQuery.keys[key]);
		
	return server+([].splice.call(arguments,0).concat(staticKeys).join("/"));
}

function ServerQueryAppendKey(key, value)
{
	if (arguments.length==1) 
	{
		key_split = key.split("=");
		BuildServerQuery.keys[key_split[0]] = key_split[1];
	}
	else
		BuildServerQuery.keys[key] = value;
	
}

function ServerQueryRemoveKey(key)
{
	delete BuildServerQuery.keys[key];
}


/* Simple error message using HTML template */
function ErrorMessage(error_text)
{
	$.fancybox($("#server-error").html()+error_text,
	{
				"autoDimensions"	: false,
				"width"         		: 280,
				"height"        		: 320,
				"hideOnOverlayClick" : false,
				"showCloseButton"	: false
	});
}
