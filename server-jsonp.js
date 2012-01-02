/* 
 * Server communication functions
 * 
 * JSONP version
 * 
 * This supports cross-site requests
 * Not entirely functional, needs to be finished
 * 
 * 
 * */
 
 /* basic AJAX function; still need this for SVG extraction */
function loadXMLDoc(dname)
{
	if (window.XMLHttpRequest)
		xhttp=new XMLHttpRequest();
	else
		xhttp=new ActiveXObject("Microsoft.XMLHTTP");
	  
	xhttp.open("GET",dname,false);
	xhttp.send();
	
	return xhttp;
}


function SetData(data)
{
	//alert("this");
	SetData.data = data;
}

function loadData(query)
{
	req = $.ajax({
	  url: query+"/Format=JSON/JSONP=SetData",
	  dataType: "script",
	  async: false,
	  cache: false
	});
	
	datatype = typeof(SetData.data);
	
	if (datatype != "object") 
	{	
		var error_text = "";
		
		if (datatype == "string")
			error_text = "<br/><b>The error message was:</b> "+SetData.data;
			
		ErrorMessage(error_text);
	}

	return SetData.data;
}

//QueryForeach.counter = 0; //rem
function QueryForeach(query,key,foreach_func)
{
	/*var time = new Date(); //rem
	start = time.getTime(); //rem
	*/
	tree = loadData(query);
	results = tree[key];

	if (!results)
		return 0;
	
	/* JSON results can be returned from the server either as an object, or as an array of objects */
	if (foreach_func)
	{
		if (results.length) /* in the second case, a .length element will be defined */
			for (var i = 0, len=results.length; i < len; i++)
				foreach_func(results[i]);
		else
			foreach_func(results);
	}
			
	/*var timenow = new Date(); //rem
	console.log(QueryForeach.counter+" "+((timenow.getTime())-start)+"ms"); //rem
	QueryForeach.counter++; //rem	
	*/
	
	return results.length ? results.length : 1;
}
