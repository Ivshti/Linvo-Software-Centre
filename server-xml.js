/* 
 * Server communication functions
 * 
 * XML version
 * 
 * 
 * */

/* basic AJAX function */
function loadXMLDoc(dname)
{
	if (window.XMLHttpRequest)
		xhttp=new XMLHttpRequest();
	else
		xhttp=new ActiveXObject("Microsoft.XMLHTTP");
	  
	xhttp.open("GET",dname,false);
	xhttp.send();

	if (!xhttp.responseXML)
	{
		var error_text = "";
		
		if (xhttp.responseText)
			error_text = "<br/><b>The error message was:</b> "+xhttp.responseText;

		ErrorMessage(error_text);
	}
	
	return xhttp;
}


/* turns a node into an object, putting XML attributes as "@attributes" sub-object's children */
function DOMNodeToObject(node, object)
{
	if (!object)
		object = new Object();

	/* Start with the attributes */
	if (node.attributes.length)
		object["@attributes"] = new Object(); 
		
	for (var i = 0, len=node.attributes.length; i < len; i++) 
	{
		var attrib = node.attributes[i];
		object["@attributes"][attrib.name]=attrib.value;
	}
	
	/* Recursively handle the other childNodes */
	for (var i=0, len=node.childNodes.length; i < len; i++)
	{
		iter_node = node.childNodes[i];

		if (iter_node.nodeType  == 1)
			object[iter_node.nodeName] = DOMNodeToObject(iter_node);
		else if (iter_node.nodeType == 3)
			object = iter_node.nodeValue;
	}

	return object;
}

/* queries the server (or any page returning an XML document) and turns every element with the tag element 'key' into an JSON object */
//QueryForeach.counter = 0; //rem
function QueryForeach(query,key,foreach_func)
{
	/*var time = new Date(); //rem
	start = time.getTime(); //rem
	*/
	tree = loadXMLDoc(query).responseXML;

	results = tree.getElementsByTagName(key);
		
	if (foreach_func)
		for (var i = 0, len=results.length; i < len; i++)
			foreach_func(DOMNodeToObject(results[i]));

	/*var timenow = new Date(); //rem
	console.log(QueryForeach.counter+" "+((timenow.getTime())-start)+"ms"); //rem
	QueryForeach.counter++; //rem
	*/
	return results.length;
}
