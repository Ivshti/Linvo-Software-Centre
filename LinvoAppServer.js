/* 
 * TODO:
 * #.StopAll()
 * .OnIdle() - array of callbacks? remove callbacks after once executed?
 * #.ApplyAfter()
 * 
 * #.ErrorCallback() - set a callback to be called on server error; also, .SetTimeout to set a server wait timeout
 * 
 * Taking advantage of the browser caching - instead of always passing a timestamp to prevent it completely, pass
 * a serverLastUpdate time signature, which is requested upon initialization of this object from the server and represents the time
 * of the last modification of the data
 * 
 * Make a version that emulates the actions that require authentication of the Linvo server (add/remove/etc.) using local data (using the HTML5 API)
 * 
 */

var pendingReq = 0;
var pendingReqObjects = [];

function LinvoAppServer()
{
	this.baseParameters = {Format: "JSON"};
	
	this.baseURL = arguments[0];
	this.reqChain = [];
	
	this.timeOut = 15000;
	
	this.each = function(data, callback)
	{
		if (!data)
			return;
			
		if (data.length)
			$.each(data,callback);
		else
			callback(0,data);
	}
	
	/* Walk through our array of pending request objects and call .abort() */
	this.StopAll = function()
	{
		$.each(pendingReqObjects, function(index, ajaxObj)
		{
			if (ajaxObj && ajaxObj.abort)
			{
				ajaxObj.abort();
				delete ajaxObj;
			}
		});
	}
	
	this.OnIdle = function(callback)
	{
		if (pendingReq == 0)
			callback();
		else
			this.OnIdleCB = callback;
	}
};

function LinvoAppServerData(data)
{
	this.forEach = function(callback)
	{
		if (this.length)
			$.each(this, callback);
		else
			callback(0, this);
	}
	
	return data;
}

$.each(["List", "Add", "Remove", "Download", "Auth", "ListInstallations", "UserInfo", "RegisterInstallation", "Stats", "Categories"], 
	function(index, method_name)
	{
		LinvoAppServer.prototype[method_name] = function(dictionary, callback_func)
		{
			$.extend(dictionary, this.baseParameters);
			
			var request = { request_url: method_name+"/"+toServerQuery(dictionary), callback: callback_func };
			return $.extend({}, this, {reqChain: this.reqChain.concat([request])});
		};
	});

LinvoAppServer.prototype.Apply = function()
{
	var serverobject = this, i=0;

	/* Register a slot at our array of pending objects */
	var request_index = pendingReqObjects.push(new Object())-1;
	
	var nextReq = function(data)
	{		
		if (i==0) pendingReq++;
		
		/* and issue the next request in the chain if that's possible */
		if (i < serverobject.reqChain.length)
		{
			var ajax_url = serverobject.baseURL+"/"+serverobject.reqChain[i].request_url;
			var callback =  serverobject.reqChain[i].callback;
			i++;
			
			pendingReqObjects[request_index] = $.ajax({
				url: ajax_url,
				dataType: "jsonp",
				async: true,
				cache: false,
				success: callback,
				complete: nextReq,
				error: serverobject.errorCallback,
				timeout: serverobject.timeOut
			});
		}
		else
		{
			serverobject.chainEnded = true;
			
			/* Maintain a simple request counter and execute the OnIdle callback if it's time */
			pendingReq--;
			if (pendingReq == 0 && serverobject.OnIdleCB)
				serverobject.OnIdleCB();
		
			/* And clean up our slot in the array ; the object is not destroyed since we may have references of it outside */
			delete pendingReqObjects[request_index];
		}
	};
	
	nextReq();
	return $.extend(pendingReqObjects[request_index],{LinvoAppServer: serverobject});
};

LinvoAppServer.prototype.ApplyAfter = function(XHRobj)
{
	/* If we have provided an XHR object, just append the chain of this request to the chain of the request specified, else serve as an alias to Apply() */
	if (XHRobj && !XHRobj.LinvoAppServer.chainEnded)
	{
		$.merge(XHRobj.LinvoAppServer.reqChain, this.reqChain);
		return XHRobj;
	}
	else
		return this.Apply();
}

/* Serialize a dictionary (1-level object) into a LinvoApp server-styled string */
function toServerQuery(dictionary)
{
	var args = [];
	for (var key in dictionary)
		args.push(key + (dictionary[key] !== null ? "="+dictionary[key] : ""));
	
	return args.join("/");
}

