var loginURL = "../ucp.php?mode=login";
var logoutURL = "../ucp.php?mode=logout";

/* Log-in function */
function LogIn()
{	
	var str = $("#login-form > form").serialize(); 
	str+="&login=Login&sid=";

	$.ajax({
		type: "POST",
		url: loginURL,  // Send the login info to this page
		data: str,
		success: function(data) 
		{
			$("#login-status").show();
			error_msg = $(data).find(".error").text();
			if (error_msg)
				$("#error-text").show().text(error_msg);
			else
			{
				$(".empty-on-login").empty();
				$("#error-text").hide();
				$("#login-successful").show();
				
				AuthKey = $(data).find(".icon-logout").children().attr("href");
				AuthKey = AuthKey.substring(AuthKey.indexOf("sid=")+4);
				$.cookie("AuthKey",AuthKey);
				linvoapp_server.baseParameters.AuthKey = AuthKey;
				
				setTimeout(RefreshCentre,1000);
			}	
		}
	});
}

function LogOut()
{
	$(".hide-on-logout, #login-successful").hide();
	
	$.get(logoutURL,{sid: linvoapp_server.baseParameters.AuthKey})
	.success(RefreshCentre)
	.error(function() { ErrorMessage("Log-out failed"); });
}
