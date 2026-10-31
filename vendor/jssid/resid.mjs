/* Deepfall module wrapper, 2026-10-31.
 * jsSID by Joe Hohertz; reSID by Dag Lem; GPL-2.0.
 * See vendor/jssid/LICENSE.md and UPSTREAM.json.
 * Upstream bodies unchanged. JXG declared for ES-module strict mode.
 */
var JXG;

// Top level of jsSID, common bits, etc.

// top level object, overall control:w

// Not real sure what this may look like yet, just a stub for constructor for now.
function jsSID() {
}

jsSID.version = "0.0.1";

// chip configuration constants
jsSID.chip = Object.freeze({ 
	model: { MOS6581: 0, MOS8580: 1 },
	clock: { PAL: 985248, NTSC: 1022730 }
});

jsSID.synth = {};
// sid drivers will add entries of the form:
// jsSID.synth.somesid_o1 = {
//     desc: "TinySID"
//     opts: {} 
// }

// maps to driver names as an interim between old/new expressions on drivers
jsSID.quality = Object.freeze({
        low: "tinysid",
        medium: "fastsid",
        good: "resid_fast",
        better: "resid_interpolate",
        best: "resid_resample_interpolate",
        broken: "resid_resample_fast"
});

// static factory method
jsSID.synthFactory = function(f_opts) {
        //console.log("factory", f_opts);
        f_opts = f_opts || {};
        var f_quality = f_opts.quality || jsSID.quality.good;
        var engine = jsSID.synth[f_quality];
       
        var o = {};
	var key;
        for(key in engine.opts) {
          o[key] = engine.opts[key];
        }
        for(key in f_opts) {
          o[key] = f_opts[key];
        }

        o.clock = o.clock || jsSID.chip.clock.PAL;
        o.model = o.model || jsSID.chip.model.MOS6581;
        o.sampleRate = o.sampleRate || 44100;

        //console.log("factory, class:", engine.class);
        var f_newsid = new window.jsSID[engine.class](o);
        return f_newsid;
};


/* Wrapper for accessing strings through sequential reads */
function Stream(str) {
	var position = 0;
	
	function seek(newpos) {
		position = newpos;
	}

	function read(length) {
		var result = str.substr(position, length);
		position += length;
		return result;
	}
	
	/* read a big-endian 32-bit integer */
	function readInt32() {
		var result = ( (str.charCodeAt(position) << 24) +
			(str.charCodeAt(position + 1) << 16) +
			(str.charCodeAt(position + 2) << 8) +
			str.charCodeAt(position + 3));
		position += 4;
		return result;
	}

	/* read a big-endian 16-bit integer */
	function readInt16() {
		var result = ( (str.charCodeAt(position) << 8) + str.charCodeAt(position + 1));
		position += 2;
		return result;
	}
	
	/* read an 8-bit integer */
	function readInt8(signed) {
		var result = str.charCodeAt(position);
		if (signed && result > 127) result -= 256;
		position += 1;
		return result;
	}
	
	function eof() {
		return position >= str.length;
	}
	
	/* read a MIDI-style variable-length integer
		(big-endian value in groups of 7 bits,
		with top bit set to signify that another byte follows)
	*/
	function readVarInt() {
		var result = 0;
		while (true) {
			var b = readInt8();
			if (b & 0x80) {
				result += (b & 0x7f);
				result <<= 7;
			} else {
				/* b is the last byte */
				return result + b;
			}
		}
	}
	
	return {
		'eof': eof,
		'seek': seek,
		'read': read,
		'readInt32': readInt32,
		'readInt16': readInt16,
		'readInt8': readInt8,
		'readVarInt': readVarInt
	};
}

Stream.loadRemoteFile = function (path, callback) {
	var fetch = new XMLHttpRequest();
	fetch.open('GET', path);
	if(fetch.overrideMimeType) fetch.overrideMimeType("text/plain; charset=x-user-defined");
	if(fetch.responseType) fetch.responseType = "arraybuffer";
	fetch.onreadystatechange = function() {
		if(this.readyState == 4 && this.status == 200) {
			/* munge response into a binary string */
			var t = this.responseText || "" ;
			var ff = [];
			var mx = t.length;
			var scc= String.fromCharCode;
			for (var z = 0; z < mx; z++) {
				ff[z] = scc(t.charCodeAt(z) & 255);
			}
			callback(ff.join(""));
		}
	};
	fetch.send();
};


Stream.Base64DecodeEnumerator = function(input)
{
    this._input = input;
    this._index = -1;
    this._buffer = [];
};

Stream.Base64DecodeEnumerator.prototype =
{
    current: 64,

    codex : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    moveNext: function()
    {
        if (this._buffer.length > 0)
        {
            this.current = this._buffer.shift();
            return true;
        }
        else if (this._index >= (this._input.length - 1))
        {
            this.current = 64;
            return false;
        }
        else
        {
            var enc1 = this.codex.indexOf(this._input.charAt(++this._index));
            var enc2 = this.codex.indexOf(this._input.charAt(++this._index));
            var enc3 = this.codex.indexOf(this._input.charAt(++this._index));
            var enc4 = this.codex.indexOf(this._input.charAt(++this._index));

            var chr1 = (enc1 << 2) | (enc2 >> 4);
            var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            var chr3 = ((enc3 & 3) << 6) | enc4;

            this.current = chr1;

            if (enc3 != 64)
                this._buffer.push(chr2);

            if (enc4 != 64)
                this._buffer.push(chr3);

            return true;
        }
    }
};

Stream.Base64Decode = function(input) {

        var output = []; 

        var enumerator = new Stream.Base64DecodeEnumerator(input);
        while (enumerator.moveNext())
        {
            var charCode = enumerator.current;
            output.push(String.fromCharCode(charCode));
        }

        return output.join("");
};



JXG = {exists: (function(undefined){return function(v){return !(v===undefined || v===null);}})()};
JXG.decompress = function(str) {return unescape((new JXG.Util.Unzip(JXG.Util.Base64.decodeAsArray(str))).unzip()[0][0]);};
/*
    Copyright 2008-2012
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.
    
    Dual licensed under the Apache License Version 2.0, or LGPL Version 3 licenses.

    You should have received a copy of the GNU Lesser General Public License
    along with JSXCompressor.  If not, see <http://www.gnu.org/licenses/>.
    
    You should have received a copy of the Apache License along with JSXCompressor.  
    If not, see <http://www.apache.org/licenses/>.

*/

/**
 * @fileoverview Utilities for uncompressing and base64 decoding
 */

/**
  * @class Util class
  * Class for gunzipping, unzipping and base64 decoding of files.
  * It is used for reading GEONExT, Geogebra and Intergeo files.
  *
  * Only Huffman codes are decoded in gunzip.
  * The code is based on the source code for gunzip.c by Pasi Ojala 
  * @see <a href="http://www.cs.tut.fi/~albert/Dev/gunzip/gunzip.c">http://www.cs.tut.fi/~albert/Dev/gunzip/gunzip.c</a>
  * @see <a href="http://www.cs.tut.fi/~albert">http://www.cs.tut.fi/~albert</a>
  */
JXG.Util = {};
                                 
/**
 * Unzip zip files
 */
JXG.Util.Unzip = function (barray){
    var outputArr = [],
        output = "",
        debug = false,
        gpflags,
        files = 0,
        unzipped = [],
        crc,
        buf32k = new Array(32768),
        bIdx = 0,
        modeZIP=false,

        CRC, SIZE,
    
        bitReverse = [
        0x00, 0x80, 0x40, 0xc0, 0x20, 0xa0, 0x60, 0xe0,
        0x10, 0x90, 0x50, 0xd0, 0x30, 0xb0, 0x70, 0xf0,
        0x08, 0x88, 0x48, 0xc8, 0x28, 0xa8, 0x68, 0xe8,
        0x18, 0x98, 0x58, 0xd8, 0x38, 0xb8, 0x78, 0xf8,
        0x04, 0x84, 0x44, 0xc4, 0x24, 0xa4, 0x64, 0xe4,
        0x14, 0x94, 0x54, 0xd4, 0x34, 0xb4, 0x74, 0xf4,
        0x0c, 0x8c, 0x4c, 0xcc, 0x2c, 0xac, 0x6c, 0xec,
        0x1c, 0x9c, 0x5c, 0xdc, 0x3c, 0xbc, 0x7c, 0xfc,
        0x02, 0x82, 0x42, 0xc2, 0x22, 0xa2, 0x62, 0xe2,
        0x12, 0x92, 0x52, 0xd2, 0x32, 0xb2, 0x72, 0xf2,
        0x0a, 0x8a, 0x4a, 0xca, 0x2a, 0xaa, 0x6a, 0xea,
        0x1a, 0x9a, 0x5a, 0xda, 0x3a, 0xba, 0x7a, 0xfa,
        0x06, 0x86, 0x46, 0xc6, 0x26, 0xa6, 0x66, 0xe6,
        0x16, 0x96, 0x56, 0xd6, 0x36, 0xb6, 0x76, 0xf6,
        0x0e, 0x8e, 0x4e, 0xce, 0x2e, 0xae, 0x6e, 0xee,
        0x1e, 0x9e, 0x5e, 0xde, 0x3e, 0xbe, 0x7e, 0xfe,
        0x01, 0x81, 0x41, 0xc1, 0x21, 0xa1, 0x61, 0xe1,
        0x11, 0x91, 0x51, 0xd1, 0x31, 0xb1, 0x71, 0xf1,
        0x09, 0x89, 0x49, 0xc9, 0x29, 0xa9, 0x69, 0xe9,
        0x19, 0x99, 0x59, 0xd9, 0x39, 0xb9, 0x79, 0xf9,
        0x05, 0x85, 0x45, 0xc5, 0x25, 0xa5, 0x65, 0xe5,
        0x15, 0x95, 0x55, 0xd5, 0x35, 0xb5, 0x75, 0xf5,
        0x0d, 0x8d, 0x4d, 0xcd, 0x2d, 0xad, 0x6d, 0xed,
        0x1d, 0x9d, 0x5d, 0xdd, 0x3d, 0xbd, 0x7d, 0xfd,
        0x03, 0x83, 0x43, 0xc3, 0x23, 0xa3, 0x63, 0xe3,
        0x13, 0x93, 0x53, 0xd3, 0x33, 0xb3, 0x73, 0xf3,
        0x0b, 0x8b, 0x4b, 0xcb, 0x2b, 0xab, 0x6b, 0xeb,
        0x1b, 0x9b, 0x5b, 0xdb, 0x3b, 0xbb, 0x7b, 0xfb,
        0x07, 0x87, 0x47, 0xc7, 0x27, 0xa7, 0x67, 0xe7,
        0x17, 0x97, 0x57, 0xd7, 0x37, 0xb7, 0x77, 0xf7,
        0x0f, 0x8f, 0x4f, 0xcf, 0x2f, 0xaf, 0x6f, 0xef,
        0x1f, 0x9f, 0x5f, 0xdf, 0x3f, 0xbf, 0x7f, 0xff
    ],
    
    cplens = [
        3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
        35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
    ],

    cplext = [
        0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
        3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 99, 99
    ], /* 99==invalid */

    cpdist = [
        0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d,
        0x0011, 0x0019, 0x0021, 0x0031, 0x0041, 0x0061, 0x0081, 0x00c1,
        0x0101, 0x0181, 0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01,
        0x1001, 0x1801, 0x2001, 0x3001, 0x4001, 0x6001
    ],

    cpdext = [
        0,  0,  0,  0,  1,  1,  2,  2,
        3,  3,  4,  4,  5,  5,  6,  6,
        7,  7,  8,  8,  9,  9, 10, 10,
        11, 11, 12, 12, 13, 13
    ],
    
    border = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
    
    bA = barray,

    bytepos=0,
    bitpos=0,
    bb = 1,
    bits=0,
    
    NAMEMAX = 256,
    
    nameBuf = [],
    
    fileout;
    
    function readByte(){
        bits+=8;
        if (bytepos<bA.length){
            //if (debug)
            //    document.write(bytepos+": "+bA[bytepos]+"<br>");
            return bA[bytepos++];
        } else
            return -1;
    };

    function byteAlign(){
        bb = 1;
    };
    
    function readBit(){
        var carry;
        bits++;
        carry = (bb & 1);
        bb >>= 1;
        if (bb==0){
            bb = readByte();
            carry = (bb & 1);
            bb = (bb>>1) | 0x80;
        }
        return carry;
    };

    function readBits(a) {
        var res = 0,
            i = a;
    
        while(i--) {
            res = (res<<1) | readBit();
        }
        if(a) {
            res = bitReverse[res]>>(8-a);
        }
        return res;
    };
        
    function flushBuffer(){
        //document.write('FLUSHBUFFER:'+buf32k);
        bIdx = 0;
    };
    function addBuffer(a){
        SIZE++;
        //CRC=updcrc(a,crc);
        buf32k[bIdx++] = a;
        outputArr.push(String.fromCharCode(a));
        //output+=String.fromCharCode(a);
        if(bIdx==0x8000){
            //document.write('ADDBUFFER:'+buf32k);
            bIdx=0;
        }
    };
    
    function HufNode() {
        this.b0=0;
        this.b1=0;
        this.jump = null;
        this.jumppos = -1;
    };

    var LITERALS = 288;
    
    var literalTree = new Array(LITERALS);
    var distanceTree = new Array(32);
    var treepos=0;
    var Places = null;
    var Places2 = null;
    
    var impDistanceTree = new Array(64);
    var impLengthTree = new Array(64);
    
    var len = 0;
    var fpos = new Array(17);
    fpos[0]=0;
    var flens;
    var fmax;
    
    function IsPat() {
        while (1) {
            if (fpos[len] >= fmax)
                return -1;
            if (flens[fpos[len]] == len)
                return fpos[len]++;
            fpos[len]++;
        }
    };

    function Rec() {
        var curplace = Places[treepos];
        var tmp;
        if (debug)
    		document.write("<br>len:"+len+" treepos:"+treepos);
        if(len==17) { //war 17
            return -1;
        }
        treepos++;
        len++;
    	
        tmp = IsPat();
        if (debug)
        	document.write("<br>IsPat "+tmp);
        if(tmp >= 0) {
            curplace.b0 = tmp;    /* leaf cell for 0-bit */
            if (debug)
            	document.write("<br>b0 "+curplace.b0);
        } else {
        /* Not a Leaf cell */
        curplace.b0 = 0x8000;
        if (debug)
        	document.write("<br>b0 "+curplace.b0);
        if(Rec())
            return -1;
        }
        tmp = IsPat();
        if(tmp >= 0) {
            curplace.b1 = tmp;    /* leaf cell for 1-bit */
            if (debug)
            	document.write("<br>b1 "+curplace.b1);
            curplace.jump = null;    /* Just for the display routine */
        } else {
            /* Not a Leaf cell */
            curplace.b1 = 0x8000;
            if (debug)
            	document.write("<br>b1 "+curplace.b1);
            curplace.jump = Places[treepos];
            curplace.jumppos = treepos;
            if(Rec())
                return -1;
        }
        len--;
        return 0;
    };

    function CreateTree(currentTree, numval, lengths, show) {
        var i;
        /* Create the Huffman decode tree/table */
        //document.write("<br>createtree<br>");
        if (debug)
        	document.write("currentTree "+currentTree+" numval "+numval+" lengths "+lengths+" show "+show);
        Places = currentTree;
        treepos=0;
        flens = lengths;
        fmax  = numval;
        for (i=0;i<17;i++)
            fpos[i] = 0;
        len = 0;
        if(Rec()) {
            //fprintf(stderr, "invalid huffman tree\n");
            if (debug)
            	alert("invalid huffman tree\n");
            return -1;
        }
        if (debug){
        	document.write('<br>Tree: '+Places.length);
        	for (var a=0;a<32;a++){
            	document.write("Places["+a+"].b0="+Places[a].b0+"<br>");
            	document.write("Places["+a+"].b1="+Places[a].b1+"<br>");
        	}
        }
    
        /*if(show) {
            var tmp;
            for(tmp=currentTree;tmp<Places;tmp++) {
                fprintf(stdout, "0x%03x  0x%03x (0x%04x)",tmp-currentTree, tmp->jump?tmp->jump-currentTree:0,(tmp->jump?tmp->jump-currentTree:0)*6+0xcf0);
                if(!(tmp.b0 & 0x8000)) {
                    //fprintf(stdout, "  0x%03x (%c)", tmp->b0,(tmp->b0<256 && isprint(tmp->b0))?tmp->b0:'�');
                }
                if(!(tmp.b1 & 0x8000)) {
                    if((tmp.b0 & 0x8000))
                        fprintf(stdout, "           ");
                    fprintf(stdout, "  0x%03x (%c)", tmp->b1,(tmp->b1<256 && isprint(tmp->b1))?tmp->b1:'�');
                }
                fprintf(stdout, "\n");
            }
        }*/
        return 0;
    };
    
    function DecodeValue(currentTree) {
        var len, i,
            xtreepos=0,
            X = currentTree[xtreepos],
            b;

        /* decode one symbol of the data */
        while(1) {
            b=readBit();
            if (debug)
            	document.write("b="+b);
            if(b) {
                if(!(X.b1 & 0x8000)){
                	if (debug)
                    	document.write("ret1");
                    return X.b1;    /* If leaf node, return data */
                }
                X = X.jump;
                len = currentTree.length;
                for (i=0;i<len;i++){
                    if (currentTree[i]===X){
                        xtreepos=i;
                        break;
                    }
                }
                //xtreepos++;
            } else {
                if(!(X.b0 & 0x8000)){
                	if (debug)
                    	document.write("ret2");
                    return X.b0;    /* If leaf node, return data */
                }
                //X++; //??????????????????
                xtreepos++;
                X = currentTree[xtreepos];
            }
        }
        if (debug)
        	document.write("ret3");
        return -1;
    };
    
    function DeflateLoop() {
    var last, c, type, i, len;

    do {
        /*if((last = readBit())){
            fprintf(errfp, "Last Block: ");
        } else {
            fprintf(errfp, "Not Last Block: ");
        }*/
        last = readBit();
        type = readBits(2);
        switch(type) {
            case 0:
            	if (debug)
                	alert("Stored\n");
                break;
            case 1:
            	if (debug)
                	alert("Fixed Huffman codes\n");
                break;
            case 2:
            	if (debug)
                	alert("Dynamic Huffman codes\n");
                break;
            case 3:
            	if (debug)
                	alert("Reserved block type!!\n");
                break;
            default:
            	if (debug)
                	alert("Unexpected value %d!\n", type);
                break;
        }

        if(type==0) {
            var blockLen, cSum;

            // Stored 
            byteAlign();
            blockLen = readByte();
            blockLen |= (readByte()<<8);

            cSum = readByte();
            cSum |= (readByte()<<8);

            if(((blockLen ^ ~cSum) & 0xffff)) {
                document.write("BlockLen checksum mismatch\n");
            }
            while(blockLen--) {
                c = readByte();
                addBuffer(c);
            }
        } else if(type==1) {
            var j;

            /* Fixed Huffman tables -- fixed decode routine */
            while(1) {
            /*
                256    0000000        0
                :   :     :
                279    0010111        23
                0   00110000    48
                :    :      :
                143    10111111    191
                280 11000000    192
                :    :      :
                287 11000111    199
                144    110010000    400
                :    :       :
                255    111111111    511
    
                Note the bit order!
                */

            j = (bitReverse[readBits(7)]>>1);
            if(j > 23) {
                j = (j<<1) | readBit();    /* 48..255 */

                if(j > 199) {    /* 200..255 */
                    j -= 128;    /*  72..127 */
                    j = (j<<1) | readBit();        /* 144..255 << */
                } else {        /*  48..199 */
                    j -= 48;    /*   0..151 */
                    if(j > 143) {
                        j = j+136;    /* 280..287 << */
                        /*   0..143 << */
                    }
                }
            } else {    /*   0..23 */
                j += 256;    /* 256..279 << */
            }
            if(j < 256) {
                addBuffer(j);
                //document.write("out:"+String.fromCharCode(j));
                /*fprintf(errfp, "@%d %02x\n", SIZE, j);*/
            } else if(j == 256) {
                /* EOF */
                break;
            } else {
                var len, dist;

                j -= 256 + 1;    /* bytes + EOF */
                len = readBits(cplext[j]) + cplens[j];

                j = bitReverse[readBits(5)]>>3;
                if(cpdext[j] > 8) {
                    dist = readBits(8);
                    dist |= (readBits(cpdext[j]-8)<<8);
                } else {
                    dist = readBits(cpdext[j]);
                }
                dist += cpdist[j];

                /*fprintf(errfp, "@%d (l%02x,d%04x)\n", SIZE, len, dist);*/
                for(j=0;j<len;j++) {
                    var c = buf32k[(bIdx - dist) & 0x7fff];
                    addBuffer(c);
                }
            }
            } // while
        } else if(type==2) {
            var j, n, literalCodes, distCodes, lenCodes;
            var ll = new Array(288+32);    // "static" just to preserve stack
    
            // Dynamic Huffman tables 
    
            literalCodes = 257 + readBits(5);
            distCodes = 1 + readBits(5);
            lenCodes = 4 + readBits(4);
            //document.write("<br>param: "+literalCodes+" "+distCodes+" "+lenCodes+"<br>");
            for(j=0; j<19; j++) {
                ll[j] = 0;
            }
    
            // Get the decode tree code lengths
    
            //document.write("<br>");
            for(j=0; j<lenCodes; j++) {
                ll[border[j]] = readBits(3);
                //document.write(ll[border[j]]+" ");
            }
            //fprintf(errfp, "\n");
            //document.write('<br>ll:'+ll);
            len = distanceTree.length;
            for (i=0; i<len; i++)
                distanceTree[i]=new HufNode();
            if(CreateTree(distanceTree, 19, ll, 0)) {
                flushBuffer();
                return 1;
            }
            if (debug){
            	document.write("<br>distanceTree");
            	for(var a=0;a<distanceTree.length;a++){
                	document.write("<br>"+distanceTree[a].b0+" "+distanceTree[a].b1+" "+distanceTree[a].jump+" "+distanceTree[a].jumppos);
                	/*if (distanceTree[a].jumppos!=-1)
                    	document.write(" "+distanceTree[a].jump.b0+" "+distanceTree[a].jump.b1);
                	*/
            	}
            }
            //document.write('<BR>tree created');
    
            //read in literal and distance code lengths
            n = literalCodes + distCodes;
            i = 0;
            var z=-1;
            if (debug)
            	document.write("<br>n="+n+" bits: "+bits+"<br>");
            while(i < n) {
                z++;
                j = DecodeValue(distanceTree);
                if (debug)
                	document.write("<br>"+z+" i:"+i+" decode: "+j+"    bits "+bits+"<br>");
                if(j<16) {    // length of code in bits (0..15)
                       ll[i++] = j;
                } else if(j==16) {    // repeat last length 3 to 6 times 
                       var l;
                    j = 3 + readBits(2);
                    if(i+j > n) {
                        flushBuffer();
                        return 1;
                    }
                    l = i ? ll[i-1] : 0;
                    while(j--) {
                        ll[i++] = l;
                    }
                } else {
                    if(j==17) {        // 3 to 10 zero length codes
                        j = 3 + readBits(3);
                    } else {        // j == 18: 11 to 138 zero length codes 
                        j = 11 + readBits(7);
                    }
                    if(i+j > n) {
                        flushBuffer();
                        return 1;
                    }
                    while(j--) {
                        ll[i++] = 0;
                    }
                }
            }
            /*for(j=0; j<literalCodes+distCodes; j++) {
                //fprintf(errfp, "%d ", ll[j]);
                if ((j&7)==7)
                    fprintf(errfp, "\n");
            }
            fprintf(errfp, "\n");*/
            // Can overwrite tree decode tree as it is not used anymore
            len = literalTree.length;
            for (i=0; i<len; i++)
                literalTree[i]=new HufNode();
            if(CreateTree(literalTree, literalCodes, ll, 0)) {
                flushBuffer();
                return 1;
            }
            len = literalTree.length;
            for (i=0; i<len; i++)
                distanceTree[i]=new HufNode();
            var ll2 = new Array();
            for (i=literalCodes; i <ll.length; i++){
                ll2[i-literalCodes]=ll[i];
            }    
            if(CreateTree(distanceTree, distCodes, ll2, 0)) {
                flushBuffer();
                return 1;
            }
            if (debug)
           		document.write("<br>literalTree");
            while(1) {
                j = DecodeValue(literalTree);
                if(j >= 256) {        // In C64: if carry set
                    var len, dist;
                    j -= 256;
                    if(j == 0) {
                        // EOF
                        break;
                    }
                    j--;
                    len = readBits(cplext[j]) + cplens[j];
    
                    j = DecodeValue(distanceTree);
                    if(cpdext[j] > 8) {
                        dist = readBits(8);
                        dist |= (readBits(cpdext[j]-8)<<8);
                    } else {
                        dist = readBits(cpdext[j]);
                    }
                    dist += cpdist[j];
                    while(len--) {
                        var c = buf32k[(bIdx - dist) & 0x7fff];
                        addBuffer(c);
                    }
                } else {
                    addBuffer(j);
                }
            }
        }
    } while(!last);
    flushBuffer();

    byteAlign();
    return 0;
};

JXG.Util.Unzip.prototype.unzipFile = function(name) {
    var i;
	this.unzip();
	//alert(unzipped[0][1]);
	for (i=0;i<unzipped.length;i++){
		if(unzipped[i][1]==name) {
			return unzipped[i][0];
		}
	}
	
  };
    
    
JXG.Util.Unzip.prototype.unzip = function() {
	//convertToByteArray(input);
	if (debug)
		alert(bA);
	/*for (i=0;i<bA.length*8;i++){
		document.write(readBit());
		if ((i+1)%8==0)
			document.write(" ");
	}*/
	/*for (i=0;i<bA.length;i++){
		document.write(readByte()+" ");
		if ((i+1)%8==0)
			document.write(" ");
	}
	for (i=0;i<bA.length;i++){
		document.write(bA[i]+" ");
		if ((i+1)%16==0)
			document.write("<br>");
	}	
	*/
	//alert(bA);
	nextFile();
	return unzipped;
  };
    
 function nextFile(){
 	if (debug)
 		alert("NEXTFILE");
 	outputArr = [];
 	var tmp = [];
 	modeZIP = false;
	tmp[0] = readByte();
	tmp[1] = readByte();
	if (debug)
		alert("type: "+tmp[0]+" "+tmp[1]);
	if (tmp[0] == parseInt("78",16) && tmp[1] == parseInt("da",16)){ //GZIP
		if (debug)
			alert("GEONExT-GZIP");
		DeflateLoop();
		if (debug)
			alert(outputArr.join(''));
		unzipped[files] = new Array(2);
    	unzipped[files][0] = outputArr.join('');
    	unzipped[files][1] = "geonext.gxt";
    	files++;
	}
	if (tmp[0] == parseInt("1f",16) && tmp[1] == parseInt("8b",16)){ //GZIP
		if (debug)
			alert("GZIP");
		//DeflateLoop();
		skipdir();
		if (debug)
			alert(outputArr.join(''));
		unzipped[files] = new Array(2);
    	unzipped[files][0] = outputArr.join('');
    	unzipped[files][1] = "file";
    	files++;
	}
	if (tmp[0] == parseInt("50",16) && tmp[1] == parseInt("4b",16)){ //ZIP
		modeZIP = true;
		tmp[2] = readByte();
		tmp[3] = readByte();
		if (tmp[2] == parseInt("3",16) && tmp[3] == parseInt("4",16)){
			//MODE_ZIP
			tmp[0] = readByte();
			tmp[1] = readByte();
			if (debug)
				alert("ZIP-Version: "+tmp[1]+" "+tmp[0]/10+"."+tmp[0]%10);
			
			gpflags = readByte();
			gpflags |= (readByte()<<8);
			if (debug)
				alert("gpflags: "+gpflags);
			
			var method = readByte();
			method |= (readByte()<<8);
			if (debug)
				alert("method: "+method);
			
			readByte();
			readByte();
			readByte();
			readByte();
			
			var crc = readByte();
			crc |= (readByte()<<8);
			crc |= (readByte()<<16);
			crc |= (readByte()<<24);
			
			var compSize = readByte();
			compSize |= (readByte()<<8);
			compSize |= (readByte()<<16);
			compSize |= (readByte()<<24);
			
			var size = readByte();
			size |= (readByte()<<8);
			size |= (readByte()<<16);
			size |= (readByte()<<24);
			
			if (debug)
				alert("local CRC: "+crc+"\nlocal Size: "+size+"\nlocal CompSize: "+compSize);
			
			var filelen = readByte();
			filelen |= (readByte()<<8);
			
			var extralen = readByte();
			extralen |= (readByte()<<8);
			
			if (debug)
				alert("filelen "+filelen);
			i = 0;
			nameBuf = [];
			while (filelen--){ 
				var c = readByte();
				if (c == "/" | c ==":"){
					i = 0;
				} else if (i < NAMEMAX-1)
					nameBuf[i++] = String.fromCharCode(c);
			}
			if (debug)
				alert("nameBuf: "+nameBuf);
			
			//nameBuf[i] = "\0";
			if (!fileout)
				fileout = nameBuf;
			
			var i = 0;
			while (i < extralen){
				c = readByte();
				i++;
			}
				
			CRC = 0xffffffff;
			SIZE = 0;
			
			if (size = 0 && fileOut.charAt(fileout.length-1)=="/"){
				//skipdir
				if (debug)
					alert("skipdir");
			}
			if (method == 8){
				DeflateLoop();
				if (debug)
					alert(outputArr.join(''));
				unzipped[files] = new Array(2);
				unzipped[files][0] = outputArr.join('');
    			unzipped[files][1] = nameBuf.join('');
    			files++;
				//return outputArr.join('');
			}
			skipdir();
		}
	}
 };
	
function skipdir(){
    var crc, 
        tmp = [],
        compSize, size, os, i, c;
    
	if ((gpflags & 8)) {
		tmp[0] = readByte();
		tmp[1] = readByte();
		tmp[2] = readByte();
		tmp[3] = readByte();
		
		if (tmp[0] == parseInt("50",16) && 
            tmp[1] == parseInt("4b",16) && 
            tmp[2] == parseInt("07",16) && 
            tmp[3] == parseInt("08",16))
        {
            crc = readByte();
            crc |= (readByte()<<8);
            crc |= (readByte()<<16);
            crc |= (readByte()<<24);
		} else {
			crc = tmp[0] | (tmp[1]<<8) | (tmp[2]<<16) | (tmp[3]<<24);
		}
		
		compSize = readByte();
		compSize |= (readByte()<<8);
		compSize |= (readByte()<<16);
		compSize |= (readByte()<<24);
		
		size = readByte();
		size |= (readByte()<<8);
		size |= (readByte()<<16);
		size |= (readByte()<<24);
		
		if (debug)
			alert("CRC:");
	}

	if (modeZIP)
		nextFile();
	
	tmp[0] = readByte();
	if (tmp[0] != 8) {
		if (debug)
			alert("Unknown compression method!");
        return 0;	
	}
	
	gpflags = readByte();
	if (debug){
		if ((gpflags & ~(parseInt("1f",16))))
			alert("Unknown flags set!");
	}
	
	readByte();
	readByte();
	readByte();
	readByte();
	
	readByte();
	os = readByte();
	
	if ((gpflags & 4)){
		tmp[0] = readByte();
		tmp[2] = readByte();
		len = tmp[0] + 256*tmp[1];
		if (debug)
			alert("Extra field size: "+len);
		for (i=0;i<len;i++)
			readByte();
	}
	
	if ((gpflags & 8)){
		i=0;
		nameBuf=[];
		while (c=readByte()){
			if(c == "7" || c == ":")
				i=0;
			if (i<NAMEMAX-1)
				nameBuf[i++] = c;
		}
		//nameBuf[i] = "\0";
		if (debug)
			alert("original file name: "+nameBuf);
	}
		
	if ((gpflags & 16)){
		while (c=readByte()){
			//FILE COMMENT
		}
	}
	
	if ((gpflags & 2)){
		readByte();
		readByte();
	}
	
	DeflateLoop();
	
	crc = readByte();
	crc |= (readByte()<<8);
	crc |= (readByte()<<16);
	crc |= (readByte()<<24);
	
	size = readByte();
	size |= (readByte()<<8);
	size |= (readByte()<<16);
	size |= (readByte()<<24);
	
	if (modeZIP)
		nextFile();
	
};

};

/**
*  Base64 encoding / decoding
*  @see <a href="http://www.webtoolkit.info/">http://www.webtoolkit.info/</A>
*/
JXG.Util.Base64 = {

    // private property
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode : function (input) {
        var output = [],
            chr1, chr2, chr3, enc1, enc2, enc3, enc4,
            i = 0;

        input = JXG.Util.Base64._utf8_encode(input);

        while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output.push([this._keyStr.charAt(enc1),
                         this._keyStr.charAt(enc2),
                         this._keyStr.charAt(enc3),
                         this._keyStr.charAt(enc4)].join(''));
        }

        return output.join('');
    },

    // public method for decoding
    decode : function (input, utf8) {
        var output = [],
            chr1, chr2, chr3,
            enc1, enc2, enc3, enc4,
            i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output.push(String.fromCharCode(chr1));

            if (enc3 != 64) {
                output.push(String.fromCharCode(chr2));
            }
            if (enc4 != 64) {
                output.push(String.fromCharCode(chr3));
            }
        }
        
        output = output.join(''); 
        
        if (utf8) {
            output = JXG.Util.Base64._utf8_decode(output);
        }
        return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode : function (utftext) {
        var string = [],
            i = 0,
            c = 0, c2 = 0, c3 = 0;

        while ( i < utftext.length ) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                string.push(String.fromCharCode(c));
                i++;
            }
            else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string.push(String.fromCharCode(((c & 31) << 6) | (c2 & 63)));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string.push(String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63)));
                i += 3;
            }
        }
        return string.join('');
    },
    
    _destrip: function (stripped, wrap){
        var lines = [], lineno, i,
            destripped = [];
        
        if (wrap==null) 
            wrap = 76;
            
        stripped.replace(/ /g, "");
        lineno = stripped.length / wrap;
        for (i = 0; i < lineno; i++)
            lines[i]=stripped.substr(i * wrap, wrap);
        if (lineno != stripped.length / wrap)
            lines[lines.length]=stripped.substr(lineno * wrap, stripped.length-(lineno * wrap));
            
        for (i = 0; i < lines.length; i++)
            destripped.push(lines[i]);
        return destripped.join('\n');
    },
    
    decodeAsArray: function (input){
        var dec = this.decode(input),
            ar = [], i;
        for (i=0;i<dec.length;i++){
            ar[i]=dec.charCodeAt(i);
        }
        return ar;
    },
    
    decodeGEONExT : function (input) {
        return decodeAsArray(destrip(input),false);
    }
};

/**
 * @private
 */
JXG.Util.asciiCharCodeAt = function(str,i){
	var c = str.charCodeAt(i);
	if (c>255){
    	switch (c) {
			case 8364: c=128;
	    	break;
	    	case 8218: c=130;
	    	break;
	    	case 402: c=131;
	    	break;
	    	case 8222: c=132;
	    	break;
	    	case 8230: c=133;
	    	break;
	    	case 8224: c=134;
	    	break;
	    	case 8225: c=135;
	    	break;
	    	case 710: c=136;
	    	break;
	    	case 8240: c=137;
	    	break;
	    	case 352: c=138;
	    	break;
	    	case 8249: c=139;
	    	break;
	    	case 338: c=140;
	    	break;
	    	case 381: c=142;
	    	break;
	    	case 8216: c=145;
	    	break;
	    	case 8217: c=146;
	    	break;
	    	case 8220: c=147;
	    	break;
	    	case 8221: c=148;
	    	break;
	    	case 8226: c=149;
	    	break;
	    	case 8211: c=150;
	    	break;
	    	case 8212: c=151;
	    	break;
	    	case 732: c=152;
	    	break;
	    	case 8482: c=153;
	    	break;
	    	case 353: c=154;
	    	break;
	    	case 8250: c=155;
	    	break;
	    	case 339: c=156;
	    	break;
	    	case 382: c=158;
	    	break;
	    	case 376: c=159;
	    	break;
	    	default:
	    	break;
	    }
	}
	return c;
};

/**
 * Decoding string into utf-8
 * @param {String} string to decode
 * @return {String} utf8 decoded string
 */
JXG.Util.utf8Decode = function(utftext) {
  var string = [];
  var i = 0;
  var c = 0, c1 = 0, c2 = 0, c3;
  if (!JXG.exists(utftext)) return '';
  
  while ( i < utftext.length ) {
    c = utftext.charCodeAt(i);

    if (c < 128) {
      string.push(String.fromCharCode(c));
      i++;
    } else if((c > 191) && (c < 224)) {
      c2 = utftext.charCodeAt(i+1);
      string.push(String.fromCharCode(((c & 31) << 6) | (c2 & 63)));
      i += 2;
    } else {
      c2 = utftext.charCodeAt(i+1);
      c3 = utftext.charCodeAt(i+2);
      string.push(String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63)));
      i += 3;
    }
  };
  return string.join('');
};

/**
 * Generate a random uuid.
 * http://www.broofa.com
 * mailto:robert@broofa.com
 *
 * Copyright (c) 2010 Robert Kieffer
 * Dual licensed under the MIT and GPL licenses.
 *
 * EXAMPLES:
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 */
JXG.Util.genUUID = function() {
    // Private array of chars to use
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''),
        uuid = new Array(36), rnd=0, r;

    for (var i = 0; i < 36; i++) {
      if (i==8 || i==13 ||  i==18 || i==23) {
        uuid[i] = '-';
      } else if (i==14) {
        uuid[i] = '4';
      } else {
        if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
        r = rnd & 0xf;
        rnd = rnd >> 4;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }

    return uuid.join('');
};



// Main Object
jsSID.ReSID = function(opts) {
        opts = opts || {};
        this.sid_model = opts.model || jsSID.chip.model.MOS6581;
        var clkRate = opts.clock || jsSID.chip.clock.PAL;
	var sampleRate = opts.sampleRate || 44100;
	var method = opts.method || jsSID.ReSID.sampling_method.SAMPLE_FAST;

	this.bus_value = 0;
	this.bus_value_ttl = 0;
	this.ext_in = 0;

	// these are arrays/tables built at runtime
	this.sample = null;
	this.fir = null;

	this.voice = new Array(3);
	for(var i = 0; i < 3; i++) {
		this.voice[i] = new jsSID.ReSID.Voice();
	}
	this.filter = new jsSID.ReSID.Filter();
	this.extfilt = new jsSID.ReSID.ExternalFilter();
	this.voice[0].set_sync_source(this.voice[2]);
	this.voice[1].set_sync_source(this.voice[0]);
	this.voice[2].set_sync_source(this.voice[1]);

	this.set_sampling_parameters(clkRate, method, sampleRate);
        this.set_chip_model(this.sid_model);
}
//FIXME: original had destructor calling "delete[] sample; delete fir[]". Shouldn't matter we don't.

jsSID.ReSID.const = Object.freeze({
	FIR_N: 125,
	FIR_RES_INTERPOLATE: 285,
	FIR_RES_FAST: 51473,
	FIR_SHIFT: 15,
	RINGSIZE: 16384,
	FIXP_SHIFT: 16,
	FIXP_MASK: 0xffff
});

// EnvelopeGenerator
jsSID.ReSID.EnvelopeGenerator = function() {
	this.reset();
};

jsSID.ReSID.EnvelopeGenerator.State = Object.freeze({
	ATTACK: {}, DECAY_SUSTAIN: {}, RELEASE: {}
});

jsSID.ReSID.EnvelopeGenerator.rate_counter_period = Array(
	9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19532, 31251
);

// this one seems like overkill... idx +  (idx<<4) should do it...
jsSID.ReSID.EnvelopeGenerator.sustain_level = Array(
	0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
);

jsSID.ReSID.EnvelopeGenerator.prototype.reset = function() {
	this.envelope_counter = 0;
	this.attack = 0;
	this.decay = 0;
	this.sustain = 0;
	this.release = 0;
	this.gate = 0;
	this.rate_counter = 0;
	this.exponential_counter = 0;
	this.exponential_counter_period = 1;
	this.state = jsSID.ReSID.EnvelopeGenerator.State.RELEASE;
	this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.release];
	this.hold_zero = true;
};

jsSID.ReSID.EnvelopeGenerator.prototype.writeCONTROL_REG = function(control) {
	var gate_next = control & 0x01;
	if (!this.gate && gate_next) {
		this.state = jsSID.ReSID.EnvelopeGenerator.State.ATTACK;
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.attack];
		this.hold_zero = false;
	} else if (this.gate && !gate_next) {
		this.state = jsSID.ReSID.EnvelopeGenerator.State.RELEASE;
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.release];
	}
	this.gate = gate_next;
};

jsSID.ReSID.EnvelopeGenerator.prototype.writeATTACK_DECAY = function(attack_decay) {
	this.attack = (attack_decay >> 4) & 0x0f;
	this.decay = attack_decay & 0x0f;
	if (this.state == jsSID.ReSID.EnvelopeGenerator.State.ATTACK) {
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.attack];
	} else if (this.state == jsSID.ReSID.EnvelopeGenerator.State.DECAY_SUSTAIN) {
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.decay];
	}
};

jsSID.ReSID.EnvelopeGenerator.prototype.writeSUSTAIN_RELEASE = function(sustain_release) {
	this.sustain = (sustain_release >> 4) & 0x0f;
	this.release = sustain_release & 0x0f;
	if (this.state == jsSID.ReSID.EnvelopeGenerator.State.RELEASE) {
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.release];
	}
};

jsSID.ReSID.EnvelopeGenerator.prototype.readENV = function() {
	return this.output();
};

jsSID.ReSID.EnvelopeGenerator.prototype.output = function() {
	return this.envelope_counter;
};

// definitions of EnvelopeGenerator methods below here are called for every sample
jsSID.ReSID.EnvelopeGenerator.prototype.clock_one = function() {
	if (++this.rate_counter & 0x8000) {
		++this.rate_counter;
		this.rate_counter &= 0x7fff;
	}
	if (this.rate_counter != this.rate_period) {
		return;
	}
	this.clock_common();
};

jsSID.ReSID.EnvelopeGenerator.prototype.clock_delta = function(delta_t) {
	var rate_step = this.rate_period - this.rate_counter;
	if (rate_step <= 0) {
		rate_step += 0x7fff;
	}
	while (delta_t) {
		if (delta_t < rate_step) {
			this.rate_counter += delta_t;
			if (this.rate_counter & 0x8000) {
				++this.rate_counter;
				this.rate_counter &= 0x7fff;
			}
			return;
		}

		delta_t -= rate_step;

		this.clock_common();

		rate_step = this.rate_period;
	}

};

// FIXME: this is part of the fast path, maybe factoring it out was not the best?
jsSID.ReSID.EnvelopeGenerator.prototype.clock_common = function() {
	this.rate_counter = 0;
	if (this.state == jsSID.ReSID.EnvelopeGenerator.State.ATTACK || ++this.exponential_counter == this.exponential_counter_period) {
		this.exponential_counter = 0;
		if (this.hold_zero) {
			return;
		}
		switch (this.state) {
			case jsSID.ReSID.EnvelopeGenerator.State.ATTACK:
				++this.envelope_counter;
				this.envelope_counter &= 0xff;
				if (this.envelope_counter == 0xff) {
					this.state = jsSID.ReSID.EnvelopeGenerator.State.DECAY_SUSTAIN;
					this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.decay];
				}
				break;
			case jsSID.ReSID.EnvelopeGenerator.State.DECAY_SUSTAIN:
				if (this.envelope_counter != jsSID.ReSID.EnvelopeGenerator.sustain_level[this.sustain]) {
					--this.envelope_counter;
					this.envelope_counter &= 0xff;
				}
				break;
			case jsSID.ReSID.EnvelopeGenerator.State.RELEASE:
				--this.envelope_counter;
				this.envelope_counter &= 0xff;
				break;
		}
		this.set_exponential_counter();
	}
};

jsSID.ReSID.EnvelopeGenerator.prototype.set_exponential_counter = function() {
	switch (this.envelope_counter) {
		case 0xff:
			this.exponential_counter_period = 1;
			break;
		case 0x5d:
			this.exponential_counter_period = 2;
			break;
		case 0x36:
			this.exponential_counter_period = 4;
			break;
		case 0x1a:
			this.exponential_counter_period = 8;
			break;
		case 0x0e:
			this.exponential_counter_period = 16;
			break;
		case 0x06:
			this.exponential_counter_period = 30;
			break;
		case 0x00:
			this.exponential_counter_period = 1;
			this.hold_zero = true;
			break;
	}
};

// Waveform object
jsSID.ReSID.WaveformGenerator = function() {
	this.sync_source = this;
	this.set_chip_model(jsSID.chip.model.MOS6581);
	this.reset();
}

jsSID.ReSID.WaveformGenerator.prototype.set_chip_model = function(model) {
	if (model == jsSID.chip.model.MOS6581) {
		this.wave__ST = jsSID.ReSID.WaveformGenerator.comboTable.wave6581__ST;
		this.wave_P_T = jsSID.ReSID.WaveformGenerator.comboTable.wave6581_P_T;
		this.wave_PS_ = jsSID.ReSID.WaveformGenerator.comboTable.wave6581_PS_;
		this.wave_PST = jsSID.ReSID.WaveformGenerator.comboTable.wave6581_PST;
	} else {
		this.wave__ST = jsSID.ReSID.WaveformGenerator.comboTable.wave8580__ST;
		this.wave_P_T = jsSID.ReSID.WaveformGenerator.comboTable.wave8580_P_T;
		this.wave_PS_ = jsSID.ReSID.WaveformGenerator.comboTable.wave8580_PS_;
		this.wave_PST = jsSID.ReSID.WaveformGenerator.comboTable.wave8580_PST;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.reset = function() {
	this.accumulator = 0;
	this.shift_register = 0x7ffff8;
	this.freq = 0;
	this.waveform = 0;
	this.pw = 0;
	this.test = 0;
	this.ring_mod = 0;
	this.sync = 0;
	this.msb_rising = false;
};

jsSID.ReSID.WaveformGenerator.prototype.set_sync_source = function(source) {
	this.sync_source = source;
	source.sync_dest = this;
};

jsSID.ReSID.WaveformGenerator.prototype.writeFREQ_LO = function(freq_lo) {
	this.freq = (this.freq & 0xff00) | (freq_lo & 0x00ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writeFREQ_HI = function(freq_hi) {
	this.freq = ((freq_hi << 8) & 0xff00) | (this.freq & 0x00ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writePW_LO = function(pw_lo) {
	this.pw = (this.pw & 0xf00) | (pw_lo & 0x0ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writePW_HI = function(pw_hi) {
	this.pw = ((pw_hi << 8) & 0xf00) | (this.pw & 0x0ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writeCONTROL_REG = function(control) {
	this.waveform = (control >> 4) & 0x0f;
	this.ring_mod = control & 0x04;
	this.sync = control & 0x02;
	var test_next = control & 0x08;
	if (test_next) {
		this.accumulator = 0;
		this.shift_register = 0;
	} else if (this.test) {
		this.shift_register = 0x7ffff8;
	}
	this.test = test_next;
};

jsSID.ReSID.WaveformGenerator.prototype.readOSC = function() {
	return this.output() >> 4;
};

// definitions of EnvelopeGenerator methods below here are called for every sample
jsSID.ReSID.WaveformGenerator.prototype.clock_one = function() {
	if (this.test) {
		return;
	}
	var accumulator_prev = this.accumulator;
	this.accumulator += this.freq;
	this.accumulator &= 0xffffff;
	this.msb_rising = !(accumulator_prev & 0x800000) && (this.accumulator & 0x800000);
	if (!(accumulator_prev & 0x080000) && (this.accumulator & 0x080000)) {
		var bit0 = ((this.shift_register >> 22) ^ (this.shift_register >> 17)) & 0x1;
		this.shift_register <<= 1;
		this.shift_register &= 0x7fffff;
		this.shift_register |= bit0;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.clock_delta = function(delta_t) {
	if (this.test) {
		return;
	}
	var accumulator_prev = this.accumulator;
	var delta_accumulator = delta_t * this.freq;
	this.accumulator += delta_accumulator;
	this.accumulator &= 0xffffff;
	this.msb_rising = !(accumulator_prev & 0x800000) && (this.accumulator & 0x800000);
	var shift_period = 0x100000;
	while (delta_accumulator) {
		if (delta_accumulator < shift_period) {
			shift_period = delta_accumulator;
			if (shift_period <= 0x080000) {
				if (((this.accumulator - shift_period) & 0x080000) || !(this.accumulator & 0x080000)) {
					break;
				}
			} else {
				if (((this.accumulator - shift_period) & 0x080000) && !(this.accumulator & 0x080000)) {
					break;
				}
			}
		}

		var bit0 = ((this.shift_register >> 22) ^ (this.shift_register >> 17)) & 0x1;
		this.shift_register <<= 1;
		this.shift_register &= 0x7fffff;
		this.shift_register |= bit0;

		delta_accumulator -= shift_period;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.synchronize = function() {
	if (this.msb_rising && this.sync_dest.sync && !(this.sync && this.sync_source.msb_rising)) {
		this.sync_dest.accumulator = 0;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.output____ = function() {
	return 0x000;
};

jsSID.ReSID.WaveformGenerator.prototype.output___T = function() {
	var msb = (this.ring_mod ? this.accumulator ^ this.sync_source.accumulator : this.accumulator) & 0x800000;
	// FIXME: may need to mask inversion here
	return ((msb ? ~this.accumulator : this.accumulator) >> 11) & 0xfff;
};

jsSID.ReSID.WaveformGenerator.prototype.output__S_ = function() {
	return this.accumulator >> 12;
};

jsSID.ReSID.WaveformGenerator.prototype.output_P__ = function() {
	return (this.test || (this.accumulator >> 12) >= this.pw) ? 0xfff : 0x000;
};

jsSID.ReSID.WaveformGenerator.prototype.outputN___ = function() {
	return  ((this.shift_register & 0x400000) >> 11) |
		((this.shift_register & 0x100000) >> 10) |
		((this.shift_register & 0x010000) >> 7) |
		((this.shift_register & 0x002000) >> 5) |
		((this.shift_register & 0x000800) >> 4) |
		((this.shift_register & 0x000080) >> 1) |
		((this.shift_register & 0x000010) << 1) |
		((this.shift_register & 0x000004) << 2);
};


jsSID.ReSID.WaveformGenerator.prototype.output__ST = function() {
	return this.wave__ST[this.output__S_()] << 4;
};

jsSID.ReSID.WaveformGenerator.prototype.output_P_T = function() {
	return (this.wave_P_T[this.output___T() >> 1] << 4) & this.output_P__();
};

jsSID.ReSID.WaveformGenerator.prototype.output_PS_ = function() {
	return (this.wave_PS_[this.output__S_()] << 4) & this.output_P__();
};

jsSID.ReSID.WaveformGenerator.prototype.output_PST = function() {
	return (this.wave_PST[this.output__S_()] << 4) & this.output_P__();
};

jsSID.ReSID.WaveformGenerator.prototype.outputN__T = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputN_S_ = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputN_ST = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNP__ = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNP_T = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNPS_ = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNPST = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.output = function() {
	switch(this.waveform) {
		default:
		case 0x0:
			return this.output____();
		case 0x1:
			return this.output___T();
		case 0x2:
			return this.output__S_();
		case 0x3:
			return this.output__ST();
		case 0x4:
			return this.output_P__();
		case 0x5:
			return this.output_P_T();
		case 0x6:
			return this.output_PS_();
		case 0x7:
			return this.output_PST();
		case 0x8:
			return this.outputN___();
		case 0x9:
			return this.outputN__T();
		case 0xa:
			return this.outputN_S_();
		case 0xb:
			return this.outputN_ST();
		case 0xc:
			return this.outputNP__();
		case 0xd:
			return this.outputNP_T();
		case 0xe:
			return this.outputNPS_();
		case 0xf:
			return this.outputNPST();
	}
};

jsSID.ReSID.WaveformGenerator.comboTableCompressed = 
	"H4sIAMRzKlICA+1cT2/bNhRXl0OGrViPuxRNvsF6W4F1sYAddhmw4wZsSzRsww7DGgHDZne2ExYd" +
	"kB22Zp9gFrAPEO0UD3EdFT30GN3qommsIocYqGtrqBu7+be9R1K2JNuSU7VWE/EHU0/UE0lRpMin" +
	"n/UoSXFiYiJiBmeiJJ4ExFl+nPV/C3AOIIn2T1T7n+e4AJiaSqVE+yf6+Z8S7X+62/+SD5c5ZmZS" +
	"qUWAaH8x/4v2F/O/aH8x/4v2F/O/QIIwfSmV4NrLkizPjb3MnlQkRZkf8XwHiktCejUdoFdlVc3y" +
	"bFSoq6qombwkKxklk1lQc7nFhfiff/KS05MhcZQEUIitfCxd01aOlR6S8LQaBqLpq+760ONuva6v" +
	"8XrqNOjFmyCLWrFY1oql9fL6+nrE+hvBV08MT11YnEkIgI2g9nGlJ970hkFTG+Zdb3saNF/UUb1p" +
	"3udxE4NhVh7gUaNS2TIqm9XNarUa2D8Mw3JfO41zicGwrB13fdx6KMcCPGLVpOciHlNZqzWsWr1Z" +
	"bzabvH0Mfp5NhWXZGCzbfsLLceJPIbUN2LXtVrvVbrd5OTaEjt3pPAMtyj0I+539/X0WPziA3+HB" +
	"4eFh5+CI4T8P+MGDDpwCJ+LpB5DQtiALyKhj70HA+DMqWYFYSbgEuBB6QTYeewpbkAYG0JMnrjg2" +
	"i80EVph2ZrgFcCNqVqNWozk+pgKrzM57xMvBvCAqORIDpt/h5fj1hLckxomvYd2ALgAdoWJsVSpG" +
	"Bcp5UIFuAmlMns990zR4d2LlGsST312qRj27Hue6HL0/7i9/g1Wze54jJVf6wAcw4ggKQ0B5vVTS" +
	"yiUYFjRCbhZ1Pliweq7pOgwkRNL4dWm++qzqmkdPiH/ICi5/RdNoSc55JOIAe1wU/iCB/YPEPIG9" +
	"bIAJsLCYy6kLOTALFEXKZzKKKstgPDB9NgNmhOw1LNxIqyo3Rgbr5ZDy56FMxWcYjRNzn8q0TFlK" +
	"JlKXL4r3IIGkYjLm8ifiTf/a1Amvf0T+TXon5vq/GzH9eyH6933xGSYupqSLl1Izqbj5/8jtHxUf" +
	"x1z+JxHTfxai/8IXn+VW1hxyX5/Pzc3FXP9vI9Jp3wWr5e9dZiXyfVeoRN4NgjI/f1z+Tfbmp/wQ" +
	"qFeUH718nfITl2lJVdNqOp0O5veUq564qv6MvB7ILHJ7mWyW83twjB3Pcd4vL6uZfCafz0OdKd+H" +
	"Ibew0OX9MAj+X8z/Yv4X87+Y/8X8fyrnf0nM/4Pm/5yY/wUEBCQpJW6BgEBiMM0l/ukDFoGY/wUE" +
	"xPwvICAg5v9xYyJW/u8F+H+c2PqfEv+/pLd/BP+/KQrR/ol+/kX7n/Lnf4j/38ziK8H/i/YX879o" +
	"//jm/xPv/y/aP9LzH6/9R6Tr10mMWFpaWqaOZtzHjHnqWdxhzxW3uE8a33lx2N62o+HfTggOfDjy" +
	"uf8lnA+ZTHDdz0uXU8nmf8/OxvX9k4xBPrb/v8zSQUpMrDj+/zIHHJG5AoOqZrJ0X6XIAHI05HL4" +
	"LdCr8P0PiZa6z7uU9CQb4yVnZyBuFI5xfYSV583BOf6cWIkwfWmAVf+xnkrTNV1f09gu7hf1YrEE" +
	"AbalMvyo/3+0GZR6Qw9UcH92g3B//CHYcPIJOikAdwO1pnnP2YN906xUNnFT2dzcgl91q1qtBqSm" +
	"0313f/DcvxMywdd80Tr1/q/VG/V6vdFoNpseNXWhD5zvW13Zau3uttttm/n7D8LeHjrvuyf/w8PD" +
	"o4Hu/70FAND/3wVcQmBvb3D+9ELgEnZ3Wy3XhQWBV9EFuAUNuBm1Rr1GVwCo1wJv4IgN0LPfXJbd" +
	"QEAXgI5AOwR0DNPcxI1J1wCguGeaETrgUBCDPzobQeeQ3lM09EEb+giOBur/X6YDAo4MOmxhoECw" +
	"kWMNhw626x5guljVHc3YB0Cpf3Bn6w14Bu2QGabw568BJfD8pYD1AXzrNYx3AowOagQsgDmQy3Hj" +
	"AIDGgqpSIyKLEW5QKF0Tg4IaJ2muoEeZKRJkwPRh/muFpYup/nOzHyXaBE6lZuBFQLwACsRDgMXF" +
	"f3GcO+HdbyLS/ZmcPOn+f9HqL505F3P/ezti+uf0/5NS0tnzqQsn3/8v7uf/TMzP/5sh+jd88VnH" +
	"7MFwNrr/X9T6fxgx/Qch+m988SuO2QmG6rwc7v8Xhq9C6Lsv3XwfrsHJyToVDOm00u//x81gWUF2" +
	"UEb/P87scV4vQ7cgFTTRr2azLMr4PjiW41xfTmU8X56yfj3OD8x8xvxx/7//Ev78L8dc/lLE9NdD" +
	"3i5/d71mIk95g7/SLuPap6RQKIy5/sR3PUsjnj8wPeD6QD1bUBBxzfdG/4vz1x8NyysrIfkTh0se" +
	"wvGG/X95bTA/S6VG/lpdDUn/ty+udyXyu8V/1jz5aVqRUb9akfK9pdJNDakcxvuWiqVymXK/Zcb9" +
	"rrP1X4kndMmVkXAt4l+wdyLyz7f7eeeuRJLtljvuwh0aNjY2wgoYHO/S1bd95flp7FuBLOCtO8el" +
	"D02XxPVs7/v0FZesmBW+3q1pbiL3jbw35b63GPddDea/R8H2UO6c8ecP3XG+sGsPD7d3fOdbrrVy" +
	"R8GjQO69VnvM9+uUWq7XG0i+I/OOa+82/fx7P2yXtDl57Sa0n1jBhP1TL3vf2mXc/W6bsfeUv7cp" +
	"h0+3lFR38/nP/Jw+l/uM3d/fx7/4+/7kx7V+KduPZP6RB37eX1AQAgKJxZS4BQICScG0qkw73wIx" +
	"IkDcEwGBhOL1C8L/P5ngtMVvhajZjKYn0rDPMLufakpkDOj//tAYLyzD8HxJuP18fgOjuAYEuAK4" +
	"iID/ATiBVooAgAAA";

// expand/split tables
jsSID.ReSID.WaveformGenerator.comboTable = function() {
	var data = JXG.decompress(jsSID.ReSID.WaveformGenerator.comboTableCompressed);
	var stream = Stream(data);
	var names = [
		"wave6581__ST", "wave6581_P_T", "wave6581_PS_", "wave6581_PST",
		"wave8580__ST", "wave8580_P_T", "wave8580_PS_", "wave8580_PST"
	];
	var ret = {};
	// 8 tables
	for(var i = 0; i < 8; i++) {
		var table = new Array(4096);
		for(var j = 0; j < 4096; j++) {
			table[j] = stream.readInt8();
		}
		ret[names[i]] = table;
	}
	return ret;
}();


// Voice class
jsSID.ReSID.Voice = function() {
	this.muted = false;
	this.wave_zero = 0;
	this.voice_DC = 0;

	this.envelope = new jsSID.ReSID.EnvelopeGenerator();
	this.wave = new jsSID.ReSID.WaveformGenerator();
	this.set_chip_model(jsSID.chip.model.MOS6581);
};


jsSID.ReSID.Voice.prototype.set_chip_model = function(model) {
	this.wave.set_chip_model(model);
	if (model == jsSID.chip.model.MOS6581) {
		this.wave_zero = 0x380;
		this.voice_DC = 0x800*0xff;
	} else {
		this.wave_zero = 0x800;
		this.voice_DC = 0;
	}
};

jsSID.ReSID.Voice.prototype.set_sync_source = function(source) {
	this.wave.set_sync_source(source.wave);
};

jsSID.ReSID.Voice.prototype.writeCONTROL_REG = function(control) {
	this.wave.writeCONTROL_REG(control);
	this.envelope.writeCONTROL_REG(control);
};

jsSID.ReSID.Voice.prototype.reset = function() {
	this.wave.reset();
	this.envelope.reset();
};

jsSID.ReSID.Voice.prototype.mute = function(enable) {
	this.muted = enable;
};


// definitions of Voice methods below here are called for every sample
jsSID.ReSID.Voice.prototype.output = function() {
	if (!this.muted) {
		return (this.wave.output() - this.wave_zero) * this.envelope.output() + this.voice_DC;
	} else {
		return 0;
	}
};


// ExternalFilter class
jsSID.ReSID.ExternalFilter = function() {
	this.reset();
	this.enabled = true;
	this.set_sampling_parameter(15915.6);
	this.set_chip_model(jsSID.chip.model.MOS6581);
};

jsSID.ReSID.ExternalFilter.prototype.enable_filter = function(enable) {
	this.enabled = enable;
};


jsSID.ReSID.ExternalFilter.prototype.set_sampling_parameter = function(pass_freq) {
	this.w0hp = 105;
	this.w0lp = pass_freq * (2.0 * Math.PI * 1.048576);
	if (this.w0lp > 104858) {
		this.w0lp = 104858;
	}

};

jsSID.ReSID.ExternalFilter.prototype.set_chip_model = function(model) {
	if (model == jsSID.chip.model.MOS6581) {
		this.mixer_DC = ((((0x800 - 0x380) + 0x800)*0xff*3 - 0xfff*0xff/18) >> 7)*0x0f;
	} else {
		this.mixer_DC = 0;
	}
};


jsSID.ReSID.ExternalFilter.prototype.reset = function() {
	this.Vlp = 0;
	this.Vhp = 0;
	this.Vo = 0;
};


// definitions of ExternalFilter methods below here are called for every sample


jsSID.ReSID.ExternalFilter.prototype.clock_one = function(Vi) {
	if (!this.enabled) {
		this.Vlp = 0;
		this.Vhp = 0;
		this.Vo = Vi - this.mixer_DC;
		return;
	}

	var dVlp = (this.w0lp >> 8) * (Vi - this.Vlp) >> 12;
	var dVhp = this.w0hp * (this.Vlp - this.Vhp) >> 20;
	this.Vo = this.Vlp - this.Vhp;
	this.Vlp += dVlp;
	this.Vhp += dVhp;

};


jsSID.ReSID.ExternalFilter.prototype.clock_delta = function(Vi, delta_t) {
	if (!this.enabled) {
		this.Vlp = 0;
		this.Vhp = 0;
		this.Vo = Vi - this.mixer_DC;
		return;
	}
	var delta_t_flt = 8;
	while (delta_t) {
		if (delta_t < delta_t_flt) {
			delta_t_flt = delta_t;
		}
		var dVlp = (this.w0lp * delta_t_flt >> 8) * (Vi - this.Vlp) >> 12;
		var dVhp = this.w0hp * delta_t_flt * (this.Vlp - this.Vhp) >> 20;
		this.Vo = this.Vlp - this.Vhp;
		this.Vlp += dVlp;
		this.Vhp += dVhp;
		delta_t -= delta_t_flt;
	}
};


jsSID.ReSID.ExternalFilter.prototype.output = function() {
	return this.Vo;
};


// constructor, no.. just a collection of functions for now
jsSID.ReSID.PointPlotter = {};

jsSID.ReSID.PointPlotter.interpolate = function(inP, plot, res) {
	var k1, k2;
	var p0 = 0;
	var p1 = 1;
	var p2 = 2;
	var p3 = 3;
	var pn = inP.length - 1;

	for (; p2 != pn; ++p0, ++p1, ++p2, ++p3) {
		if (inP[p1][0] == inP[p2][0]) {
			continue;
		}
		if (inP[p0][0] == inP[p1][0] && inP[p2][0] == inP[p3][0]) {
			k1 = (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]);
			k2 = k1;
		} else if (inP[p0][0] == inP[p1][0]) {
			k2 = (inP[p3][1] - inP[p1][1]) / (inP[p3][0] - inP[p1][0]);
			k1 = (3 * (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]) - k2) / 2;
		} else if (inP[p2][0] == inP[p3][0]) {
			k1 = (inP[p2][1] - inP[p0][1]) / (inP[p2][0] - inP[p0][0]);
			k2 = (3 * (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]) - k1) / 2;
		} else {
			k1 = (inP[p2][1] - inP[p0][1]) / (inP[p2][0] - inP[p0][0]);
			k2 = (inP[p3][1] - inP[p1][1]) / (inP[p3][0] - inP[p1][0]);
		}
		jsSID.ReSID.PointPlotter.interpolate_segment(inP[p1][0], inP[p1][1], inP[p2][0], inP[p2][1], k1, k2, plot, res);
	}


};

jsSID.ReSID.PointPlotter.cubic_coefficients = function(x1, y1, x2, y2, k1, k2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var a = ((k1 + k2) - 2 * dy / dx) / (dx * dx);
	var b = ((k2 - k1) / dx - 3 * (x1 + x2) * a) / 2;
	var c = k1 - (3 * x1 * a + 2 * b) * x1;
	var d = y1 - ((x1 * a + b) * x1 + c) * x1;
	return new Object({ a: a, b: b, c: c, d: d });
};

jsSID.ReSID.PointPlotter.interpolate_brute_force = function(x1, y1, x2, y2, k1, k2, plot, res) {
	var cc = jsSID.ReSID.PointPlotter.cubic_coefficients(x1, y1, x2, y2, k1, k2);
	for (var x = x1; x <= x2; x += res) {
		var y = ((cc.a * x + cc.b) * x + cc.c) * x + cc.d;
		//plot[x] = (y < 0) ? 0 : y;
		plot[Math.floor(x)] = ((y < 0) ? 0 : y) + 0.5;
	}
};


jsSID.ReSID.PointPlotter.interpolate_forward_difference = function(x1, y1, x2, y2, k1, k2, plot, res) {
	var cc = jsSID.ReSID.PointPlotter.cubic_coefficients(x1, y1, x2, y2, k1, k2);
	var y = ((cc.a * x1 + cc.b) * x1 + cc.c) * x1 + cc.d;
	var dy = (3 * cc.a * (x1 + res) + 2 * cc.b) * x1 * res + ((cc.a * res + cc.b) * res + cc.c) * res;
	var d2y = (6 * cc.a * (x1 + res) + 2 * cc.b) * res * res;
	var d3y = 6 * cc.a * res * res * res;
	for (var x = x1; x <= x2; x += res) {
		//plot[x] = (y < 0) ? 0 : y;
		plot[Math.floor(x)] = ((y < 0) ? 0 : y) + 0.5;
		y += dy;
		dy += d2y;
		d2y += d3y;
	}
};

jsSID.ReSID.PointPlotter.spline_brute_force = false;

jsSID.ReSID.PointPlotter.interpolate_segment = 
	jsSID.ReSID.PointPlotter.spline_brute_force ?
	jsSID.ReSID.PointPlotter.interpolate_brute_force :
	jsSID.ReSID.PointPlotter.interpolate_forward_difference;


// Filter class
jsSID.ReSID.Filter = function() {
	this.fc = 0;
	this.res = 0;
	this.filt = 0;
	this.voice3off = 0;
	this.hp_bp_lp = 0;
	this.vol = 0;
	this.Vhp = 0;
	this.Vbp = 0;
	this.Vlp = 0;
	this.Vnf = 0;
	this.enabled = true;
	this.w0 = 0;
	this.w0_ceil_1 = 0;
	this.w0_ceil_dt = 0;
	this.mixerDC = 0;

	this.f0_6581 = new Array(2048);
	this.f0_8580 = new Array(2048);
	// Create mappings from FC to cutoff frequency.
	jsSID.ReSID.PointPlotter.interpolate(jsSID.ReSID.Filter.f0_points_6581, this.f0_6581, 1.0);
	jsSID.ReSID.PointPlotter.interpolate(jsSID.ReSID.Filter.f0_points_8580, this.f0_8580, 1.0);

	this.set_chip_model(jsSID.chip.model.MOS6581);
};

jsSID.ReSID.Filter.f0_points_6581 = new Array(
	[    0,   220 ], [    0,   220 ], [  128,   230 ], [  256,   250 ],
	[  384,   300 ], [  512,   420 ], [  640,   780 ], [  768,  1600 ],
	[  832,  2300 ], [  896,  3200 ], [  960,  4300 ], [  992,  5000 ],
	[ 1008,  5400 ], [ 1016,  5700 ], [ 1023,  6000 ], [ 1023,  6000 ],
	[ 1024,  4600 ], [ 1024,  4600 ], [ 1032,  4800 ], [ 1056,  5300 ],
	[ 1088,  6000 ], [ 1120,  6600 ], [ 1152,  7200 ], [ 1280,  9500 ],
	[ 1408, 12000 ], [ 1536, 14500 ], [ 1664, 16000 ], [ 1792, 17100 ],
	[ 1920, 17700 ], [ 2047, 18000 ], [ 2047, 18000 ]
);

jsSID.ReSID.Filter.f0_points_8580 = new Array(
	[    0,     0 ], [    0,     0 ], [  128,   800 ], [  256,  1600 ],
	[  384,  2500 ], [  512,  3300 ], [  640,  4100 ], [  768,  4800 ],
	[  896,  5600 ], [ 1024,  6500 ], [ 1152,  7500 ], [ 1280,  8400 ],
	[ 1408,  9200 ], [ 1536,  9800 ], [ 1664, 10500 ], [ 1792, 11000 ],
	[ 1920, 11700 ], [ 2047, 12500 ], [ 2047, 12500 ]
);

jsSID.ReSID.Filter.prototype.enable_filter = function(enable) {
	this.enabled = enable;
};

jsSID.ReSID.Filter.prototype.set_chip_model = function(model) {
	if (model == jsSID.chip.model.MOS6581) {
		this.mixer_DC = -0xfff*0xff/18 >> 7;
		this.f0 = this.f0_6581;
		this.f0_points = jsSID.ReSID.Filter.f0_points_6581;
	} else {
		this.mixer_DC = 0;
		this.f0 = this.f0_8580;
		this.f0_points = jsSID.ReSID.Filter.f0_points_8580;
	}
	this.f0_count = this.f0_points.length;
	this.set_w0();
	this.set_Q();
};

jsSID.ReSID.Filter.prototype.reset = function() {
	this.fc = 0;
	this.res = 0;
	this.filt = 0;
	this.voice3off = 0;
	this.hp_bp_lp = 0;
	this.vol = 0;
	this.Vhp = 0;
	this.Vbp = 0;
	this.Vlp = 0;
	this.Vnf = 0;


	this.set_w0();
	this.set_Q();
};

jsSID.ReSID.Filter.prototype.writeFC_LO = function(fc_lo) {
	this.fc = (this.fc & 0x7f8) | (fc_lo & 0x007);
	this.set_w0();
};

jsSID.ReSID.Filter.prototype.writeFC_HI = function(fc_hi) {
	this.fc = ((fc_hi << 3) & 0x7f8) | (this.fc & 0x007);
	this.set_w0();
};

jsSID.ReSID.Filter.prototype.writeRES_FILT = function(res_filt) {
	this.res = (res_filt >> 4) & 0x0f;
	this.set_Q();
	this.filt = res_filt & 0x0f;
};

jsSID.ReSID.Filter.prototype.writeMODE_VOL = function(mode_vol) {
	this.voice3off = mode_vol & 0x80;
	this.hp_bp_lp = (mode_vol >> 4) & 0x07;
	this.vol = mode_vol & 0x0f;
};

jsSID.ReSID.Filter.prototype.set_w0 = function() {
	this.w0 = 2 * Math.PI * this.f0[this.fc] * 1.048576;

	// FIXME: move these to be const
	var w0_max_1 = 2 * Math.PI * 16000 * 1.048576;
	var w0_max_dt = 2 * Math.PI * 4000 * 1.048576;

	this.w0_ceil_1 = this.w0 <= w0_max_1 ? this.w0 : w0_max_1;
	this.w0_ceil_dt = this.w0 <= w0_max_dt ? this.w0 : w0_max_dt;
};

jsSID.ReSID.Filter.prototype.set_Q = function() {
	this._1024_div_Q = 1024.0 / (0.707 + 1.0 * this.res / 0x0f);
};


// definitions of Filter methods below here are called for every sample


jsSID.ReSID.Filter.prototype.clock_one = function(voice1, voice2, voice3, ext_in) {
	voice1 >>= 7;
	voice2 >>= 7;
	if (this.voice3off && !(this.filt & 0x04)) {
		voice3 = 0;
	} else {
		voice3 >>= 7;
	}
	ext_in >>= 7;

	if (!this.enabled) {
		this.Vnf = voice1 + voice2 + voice3 + ext_in;
		this.Vhp = 0;
		this.Vbp = 0;
		this.Vlp = 0;
		return;
	}


	var Vi;
	switch (this.filt) {
		default:
		case 0x0:
			Vi = 0;
			this.Vnf = voice1 + voice2 + voice3 + ext_in;
			break;
		case 0x1:
			Vi = voice1;
			this.Vnf = voice2 + voice3 + ext_in;
			break;
		case 0x2:
			Vi = voice2;
			this.Vnf = voice1 + voice3 + ext_in;
			break;
		case 0x3:
			Vi = voice1 + voice2;
			this.Vnf = voice3 + ext_in;
			break;
		case 0x4:
			Vi = voice3;
			this.Vnf = voice1 + voice2 + ext_in;
			break;
		case 0x5:
			Vi = voice1 + voice3;
			this.Vnf = voice2 + ext_in;
			break;
		case 0x6:
			Vi = voice2 + voice3;
			this.Vnf = voice1 + ext_in;
			break;
		case 0x7:
			Vi = voice1 + voice2 + voice3;
			this.Vnf = ext_in;
			break;
		case 0x8:
			Vi = ext_in;
			this.Vnf = voice1 + voice2 + voice3;
			break;
		case 0x9:
			Vi = voice1 + ext_in;
			this.Vnf = voice2 + voice3;
			break;
		case 0xa:
			Vi = voice2 + ext_in;
			this.Vnf = voice1 + voice3;
			break;
		case 0xb:
			Vi = voice1 + voice2 + ext_in;
			this.Vnf = voice3;
			break;
		case 0xc:
			Vi = voice3 + ext_in;
			this.Vnf = voice1 + voice2;
			break;
		case 0xd:
			Vi = voice1 + voice3 + ext_in;
			this.Vnf = voice2;
			break;
		case 0xe:
			Vi = voice2 + voice3 + ext_in;
			this.Vnf = voice1;
			break;
		case 0xf:
			Vi = voice1 + voice2 + voice3 + ext_in;
			this.Vnf = 0;
			break;
	}
	var dVbp = (this.w0_ceil_1 * this.Vhp >> 20);
	var dVlp = (this.w0_ceil_1 * this.Vbp >> 20);
	this.Vbp -= dVbp;
	this.Vlp -= dVlp;
	this.Vhp = (this.Vbp * this._1024_div_Q >> 10) - this.Vlp - Vi;
};

jsSID.ReSID.Filter.prototype.clock_delta = function(voice1, voice2, voice3, ext_in, delta_t) {
	voice1 >>= 7;
	voice2 >>= 7;
	if (this.voice3off && !(this.filt & 0x04)) {
		voice3 = 0;
	} else {
		voice3 >>= 7;
	}
	ext_in >>= 7;

	if (!this.enabled) {
		this.Vnf = voice1 + voice2 + voice3 + ext_in;
		this.Vhp = 0;
		this.Vbp = 0;
		this.Vlp = 0;
		return;
	}


	var Vi;
	switch (this.filt) {
		default:
		case 0x0:
			Vi = 0;
			this.Vnf = voice1 + voice2 + voice3 + ext_in;
			break;
		case 0x1:
			Vi = voice1;
			this.Vnf = voice2 + voice3 + ext_in;
			break;
		case 0x2:
			Vi = voice2;
			this.Vnf = voice1 + voice3 + ext_in;
			break;
		case 0x3:
			Vi = voice1 + voice2;
			this.Vnf = voice3 + ext_in;
			break;
		case 0x4:
			Vi = voice3;
			this.Vnf = voice1 + voice2 + ext_in;
			break;
		case 0x5:
			Vi = voice1 + voice3;
			this.Vnf = voice2 + ext_in;
			break;
		case 0x6:
			Vi = voice2 + voice3;
			this.Vnf = voice1 + ext_in;
			break;
		case 0x7:
			Vi = voice1 + voice2 + voice3;
			this.Vnf = ext_in;
			break;
		case 0x8:
			Vi = ext_in;
			this.Vnf = voice1 + voice2 + voice3;
			break;
		case 0x9:
			Vi = voice1 + ext_in;
			this.Vnf = voice2 + voice3;
			break;
		case 0xa:
			Vi = voice2 + ext_in;
			this.Vnf = voice1 + voice3;
			break;
		case 0xb:
			Vi = voice1 + voice2 + ext_in;
			this.Vnf = voice3;
			break;
		case 0xc:
			Vi = voice3 + ext_in;
			this.Vnf = voice1 + voice2;
			break;
		case 0xd:
			Vi = voice1 + voice3 + ext_in;
			this.Vnf = voice2;
			break;
		case 0xe:
			Vi = voice2 + voice3 + ext_in;
			this.Vnf = voice1;
			break;
		case 0xf:
			Vi = voice1 + voice2 + voice3 + ext_in;
			this.Vnf = 0;
			break;
	}

	var delta_t_flt = 8;
	while (delta_t) {
		if (delta_t < delta_t_flt) {
			delta_t_flt = delta_t;
		}
		var w0_delta_t = this.w0_ceil_dt * delta_t_flt >> 6;
		var dVbp = w0_delta_t * this.Vhp >> 14;
		var dVlp = w0_delta_t * this.Vbp >> 14;
		this.Vbp -= dVbp;
		this.Vlp -= dVlp;
		this.Vhp = (this.Vbp * this._1024_div_Q >> 10) - this.Vlp - Vi;
		delta_t -= delta_t_flt;
	}
};


jsSID.ReSID.Filter.prototype.output = function() {
	if (!this.enabled) {
		return (this.Vnf + this.mixer_DC) * this.vol;
	}
	var Vf;
	switch (this.hp_bp_lp) {
		default:
		case 0x0:
			Vf = 0;
			break;
		case 0x1:
			Vf = this.Vlp;
			break;
		case 0x2:
			Vf = this.Vbp;
			break;
		case 0x3:
			Vf = this.Vlp + this.Vbp;
			break;
		case 0x4:
			Vf = this.Vhp;
			break;
		case 0x5:
			Vf = this.Vlp + this.Vhp;
			break;
		case 0x6:
			Vf = this.Vbp + this.Vhp;
			break;
		case 0x7:
			Vf = this.Vlp + this.Vbp + this.Vhp;
			break;
	}
	return (this.Vnf + Vf + this.mixer_DC) * this.vol;
};


jsSID.ReSID.sampling_method = Object.freeze({
	SAMPLE_FAST: {},
	SAMPLE_INTERPOLATE: {},
	SAMPLE_RESAMPLE_INTERPOLATE: {},
	SAMPLE_RESAMPLE_FAST: {}
});

jsSID.ReSID.prototype.set_chip_model = function(model) {
	for (var i = 0; i < 3; i++) {
		this.voice[i].set_chip_model(model);
	}

	this.filter.set_chip_model(model);
	this.extfilt.set_chip_model(model);
};

jsSID.ReSID.prototype.reset = function() {
	for (var i = 0; i < 3; i++) {
		this.voice[i].reset();
	}
	this.filter.reset();
	this.extfilt.reset();
	this.bus_value = 0;
	this.bus_value_ttl = 0;
};

jsSID.ReSID.prototype.input = function(sample) {
	this.ext_in = (sample << 4) * 3;
};


jsSID.ReSID.prototype.output = function(bits) {
	if(!bits) {
		bits = 16;
	}
	var range = 1 << bits;
	var half = range >> 1;
	var sample = this.extfilt.output()  /((4095 * 255 >> 7) * 3 * 15 * 2 / range);
	if (sample >= half) {
		return half - 1;
	}
	if (sample < -half) {
		return -half;
	}
	return sample;
};


jsSID.ReSID.prototype.read = function(offset) {
	switch (offset) {
			// We don't model the potentiometers
		case 0x19:
		case 0x1a:
			return 0xFF;
		case 0x1b:
			return this.voice[2].wave.readOSC();
		case 0x1c:
			return this.voice[2].envelope.readENV();
		default:
			return this.bus_value;
	}
};

jsSID.ReSID.prototype.poke = function(offset, value) {
	this.write(offset, value);
};

jsSID.ReSID.prototype.pokeDigi = function(offset, value) {
	// not yet implemented
	return;
};

jsSID.ReSID.prototype.write = function(offset, value) {
	this.bus_value = value;
	this.bus_value_ttl = 0x2000;

	switch (offset) {
		case 0x00:
			this.voice[0].wave.writeFREQ_LO(value);
			break;
		case 0x01:
			this.voice[0].wave.writeFREQ_HI(value);
			break;
		case 0x02:
			this.voice[0].wave.writePW_LO(value);
			break;
		case 0x03:
			this.voice[0].wave.writePW_HI(value);
			break;
		case 0x04:
			this.voice[0].writeCONTROL_REG(value);
			break;
		case 0x05:
			this.voice[0].envelope.writeATTACK_DECAY(value);
			break;
		case 0x06:
			this.voice[0].envelope.writeSUSTAIN_RELEASE(value);
			break;
		case 0x07:
			this.voice[1].wave.writeFREQ_LO(value);
			break;
		case 0x08:
			this.voice[1].wave.writeFREQ_HI(value);
			break;
		case 0x09:
			this.voice[1].wave.writePW_LO(value);
			break;
		case 0x0a:
			this.voice[1].wave.writePW_HI(value);
			break;
		case 0x0b:
			this.voice[1].writeCONTROL_REG(value);
			break;
		case 0x0c:
			this.voice[1].envelope.writeATTACK_DECAY(value);
			break;
		case 0x0d:
			this.voice[1].envelope.writeSUSTAIN_RELEASE(value);
			break;
		case 0x0e:
			this.voice[2].wave.writeFREQ_LO(value);
			break;
		case 0x0f:
			this.voice[2].wave.writeFREQ_HI(value);
			break;
		case 0x10:
			this.voice[2].wave.writePW_LO(value);
			break;
		case 0x11:
			this.voice[2].wave.writePW_HI(value);
			break;
		case 0x12:
			this.voice[2].writeCONTROL_REG(value);
			break;
		case 0x13:
			this.voice[2].envelope.writeATTACK_DECAY(value);
			break;
		case 0x14:
			this.voice[2].envelope.writeSUSTAIN_RELEASE(value);
			break;
		case 0x15:
			this.filter.writeFC_LO(value);
			break;
		case 0x16:
			this.filter.writeFC_HI(value);
			break;
		case 0x17:
			this.filter.writeRES_FILT(value);
			break;
		case 0x18:
			this.filter.writeMODE_VOL(value);
			break;
		default:
			break;
	}
};


jsSID.ReSID.prototype.mute= function(channel, enable) {
  if (channel >= 3) return;
  this.voice[channel].mute(enable);
};

jsSID.ReSID.prototype.enable_filter = function(enable) {
	this.filter.enable_filter(enable);
};

jsSID.ReSID.prototype.enable_external_filter = function(enable) {
	this.extfilt.enable_filter(enable);
};

jsSID.ReSID.prototype.I0 = function(x) {
	var I0e = 1e-6;			// FIXME: const, used once
	var sum = 1;
	var u = 1;
	var n = 1;
	var halfx = x / 2.0;
	var temp;
	do {
		temp = halfx / n++;
		u *= temp * temp;
		sum += u;
	} while (u >= I0e * sum);
	return sum;
};


// Use a clock freqency of 985248Hz for PAL C64, 1022730Hz for NTSC C64.
jsSID.ReSID.prototype.set_sampling_parameters = function(clock_freq, method, sample_freq, pass_freq, filter_scale) {
	pass_freq = pass_freq || -1;
	filter_scale = filter_scale || 0.97;

	if (method == jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE || method == jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST) {
		if (jsSID.ReSID.const.FIR_N * clock_freq / sample_freq >= jsSID.ReSID.const.RINGSIZE) {
			return false;
		}
	}
	if (pass_freq < 0) {
		pass_freq = 20000;
		if (2 * pass_freq / sample_freq >= 0.9) {
			pass_freq = 0.9 * sample_freq / 2;
		}
	} else if (pass_freq > 0.9 * sample_freq / 2) {
		return false;
	}
	if (filter_scale < 0.9 || filter_scale > 1.0) {
		return false;
	}
	this.extfilt.set_sampling_parameter(pass_freq);
	this.clock_frequency = clock_freq;
	this.mix_freq = sample_freq;
	this.sampling = method;
	this.cycles_per_sample = Math.floor(clock_freq / sample_freq * (1 << jsSID.ReSID.const.FIXP_SHIFT) + 0.5);
	this.sample_offset = 0;
	this.sample_prev = 0;

	if (method != jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE && method != jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST) {
		this.sample = null;
		this.fir = null;
		return true;
	}

	var A = -20 * (Math.log(1.0 / (1 << 16)) / Math.LN10);		// FIXME: constant
	var dw = (1 - 2 * pass_freq / sample_freq) * Math.PI;
	var wc = (2 * pass_freq / sample_freq + 1) * Math.PI / 2;
	var beta = 0.1102 * (A - 8.7);			// FIXME: constant
	var I0beta = this.I0(beta);				// FIXME: constant
	var N = Math.floor((A - 7.95) / (2.285 * dw) + 0.5);
	N += N & 1;

	var f_samples_per_cycle = sample_freq / clock_freq;
	var f_cycles_per_sample = clock_freq / sample_freq;
	// FIXME: cast int became floor
	this.fir_N = Math.floor(N * f_cycles_per_sample) + 1;
	this.fir_N |= 1;

	var res = (method == jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE) ? jsSID.ReSID.const.FIR_RES_INTERPOLATE : jsSID.ReSID.const.FIR_RES_FAST;
	var n = Math.ceil(Math.log(res / f_cycles_per_sample) / Math.log(2));
	this.fir_RES = 1 << n;

	this.fir = new Array(this.fir_N * this.fir_RES);

	for (var i = 0; i < this.fir_RES; i++) {
		var fir_offset = i * this.fir_N + this.fir_N / 2;
		// FIXME: i below was cast to double before. should be ok, clean up when confirmed
		var j_offset = i / this.fir_RES;
		for (var j = -this.fir_N / 2; j <= this.fir_N / 2; j++) {
			var jx = j - j_offset;
			var wt = wc * jx / f_cycles_per_sample;
			var temp = jx / (this.fir_N / 2);
			var Kaiser = Math.abs(temp) <= 1 ? this.I0(beta * Math.sqrt(1 - temp * temp)) / I0beta : 0;
			var sincwt = Math.abs(wt) >= 1e-6 ? Math.sin(wt) / wt : 1;
			var val = (1 << jsSID.ReSID.const.FIR_SHIFT) * filter_scale * f_samples_per_cycle * wc / Math.PI * sincwt * Kaiser;
			// FIXME: was a cast to short, convered to Math.floor. Clean once confirmed
			this.fir[fir_offset + j] = Math.floor(val + 0.5);
		}
	}

	// Allocate sample buffer.
	if (!this.sample) {
		this.sample = new Array(jsSID.ReSID.const.RINGSIZE * 2);
	}
	// Clear sample buffer.
	for (var k = 0; k < jsSID.ReSID.const.RINGSIZE * 2; k++) {
		this.sample[k] = 0;
	}
	this.sample_index = 0;
	return true;
};

jsSID.ReSID.prototype.adjust_sampling_frequency = function(sample_freq) {
	// FIXME: casting warning, using floor
	this.cycles_per_sample = Math.floor(this.clock_frequency/sample_freq*(1 << jsSID.ReSID.const.FIXP_SHIFT) + 0.5);
};

jsSID.ReSID.prototype.clock_one = function() {
	var i;
	if (--this.bus_value_ttl <= 0) {
		this.bus_value = 0;
		this.bus_value_ttl = 0;
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].envelope.clock_one();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.clock_one();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.synchronize();
	}
	this.filter.clock_one(this.voice[0].output(), this.voice[1].output(), this.voice[2].output(), this.ext_in);
	this.extfilt.clock_one(this.filter.output());
};

jsSID.ReSID.prototype.clock_delta = function(delta_t) {
	var i;
	if (delta_t <= 0) return;

	this.bus_value_ttl -= delta_t;
	if (this.bus_value_ttl <= 0) {
		this.bus_value = 0;
		this.bus_value_ttl = 0;
	}

	// Clock amplitude modulators.
	for (i = 0; i < 3; i++) {
		this.voice[i].envelope.clock_delta(delta_t);
	}

	// Clock and synchronize oscillators.
	// Loop until we reach the current cycle.
	var delta_t_osc = delta_t;
	while (delta_t_osc) {
		var delta_t_min = delta_t_osc;
		for (i = 0; i < 3; i++) {
			var wave = this.voice[i].wave;

			if (!(wave.sync_dest.sync && wave.freq)) {
				continue;
			}

			var freq = wave.freq;
			var accumulator = wave.accumulator;
			var delta_accumulator = (accumulator & 0x800000 ? 0x1000000 : 0x800000) - accumulator;
			var delta_t_next = delta_accumulator/freq;

			if (delta_accumulator % freq) {
				++delta_t_next;
			}

			if (delta_t_next < delta_t_min) {
				delta_t_min = delta_t_next;
			}
		}

		// Clock oscillators.
		for (i = 0; i < 3; i++) {
			this.voice[i].wave.clock_delta(delta_t_min);
		}

		// Synchronize oscillators.
		for (i = 0; i < 3; i++) {
			this.voice[i].wave.synchronize();
		}

		delta_t_osc -= delta_t_min;
	}

	// Clock filter.
	this.filter.clock_delta(this.voice[0].output(), this.voice[1].output(), this.voice[2].output(), this.ext_in, delta_t);

	// Clock external filter.
	this.extfilt.clock_delta(this.filter.output(), delta_t);

};

// Below here clocking with audio sampling
// Main one here call appropriate type
jsSID.ReSID.prototype.clock = function(delta_t, buf, n, interleave, buf_offset) {
	interleave = interleave || 1;
	buf_offset = buf_offset || 0;
	switch (this.sampling) {
		default:
		case jsSID.ReSID.sampling_method.SAMPLE_FAST:
			return this.clock_fast(delta_t, buf, n, interleave, buf_offset);
		case jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE:
			return this.clock_interpolate(delta_t, buf, n, interleave, buf_offset);
		case jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE:
			return this.clock_resample_interpolate(delta_t, buf, n, interleave, buf_offset);
		case jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST:
			return this.clock_resample_fast(delta_t, buf, n, interleave, buf_offset);
	}
};

jsSID.ReSID.prototype.clock_fast = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample + (1 << (jsSID.ReSID.const.FIXP_SHIFT - 1));
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		this.clock_delta(delta_t_sample);
		delta_t -= delta_t_sample;
		this.sample_offset = (next_sample_offset & jsSID.ReSID.const.FIXP_MASK) - (1 << (jsSID.ReSID.const.FIXP_SHIFT - 1));
		// new sample output w/ offset
		var final_sample = parseFloat(this.output()) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
	}
	this.clock_delta(delta_t);
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;
};


jsSID.ReSID.prototype.clock_interpolate = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	var i;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		for (i = 0; i < delta_t_sample - 1; i++) {
			this.clock_one();
		}
		if (i < delta_t_sample) {
			this.sample_prev = this.output();
			this.clock_one();
		}

		delta_t -= delta_t_sample;
		this.sample_offset = next_sample_offset & jsSID.ReSID.const.FIXP_MASK;

		var sample_now = this.output();
		// new sample output w/ offset
		var final_sample = parseFloat(this.sample_prev + (this.sample_offset * (sample_now - this.sample_prev) >> jsSID.ReSID.const.FIXP_SHIFT)) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
		this.sample_prev = sample_now;
	}

	for (i = 0; i < delta_t - 1; i++) {
		this.clock_one();
	}
	if (i < delta_t) {
		this.sample_prev = this.output();
		this.clock_one();
	}
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;

};


jsSID.ReSID.prototype.clock_resample_interpolate = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		for (var i = 0; i < delta_t_sample; i++) {
			this.clock_one();
			this.sample[this.sample_index] = this.output();
			this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
			++this.sample_index;
			this.sample_index &= 0x3fff;
		}
		delta_t -= delta_t_sample;
		this.sample_offset = next_sample_offset & jsSID.ReSID.const.FIXP_MASK;

		var fir_offset = this.sample_offset * this.fir_RES >> jsSID.ReSID.const.FIXP_SHIFT;
		var fir_offset_rmd = this.sample_offset * this.fir_RES & jsSID.ReSID.const.FIXP_MASK;
		var fir_start = fir_offset * this.fir_N;
		var sample_start = this.sample_index - this.fir_N + jsSID.ReSID.const.RINGSIZE;

		var v1 = 0;
		for (var j = 0; j < this.fir_N; j++) {
			v1 += this.sample[sample_start + j] * this.fir[fir_start + j];
		}

		if (++fir_offset == this.fir_RES) {
			fir_offset = 0;
			--sample_start;
		}
		fir_start = fir_offset * this.fir_N;
	
		var v2 = 0;
		for (var k = 0; k < this.fir_N; k++) {
			v2 += this.sample[sample_start + k] * this.fir[fir_start + k];
		}

		var v = v1 + (fir_offset_rmd * (v2 - v1) >> jsSID.ReSID.const.FIXP_SHIFT);
		v >>= jsSID.ReSID.const.FIR_SHIFT;

		// FIXME constant here
		var half = 1 << 15;
		if (v >= half) {
			v = half - 1;
		} else if (v < -half) {
			v = -half;
		}
		// new sample output w/ offset
		var final_sample = parseFloat(v) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
	}

	for (var m = 0; m < delta_t; m++) {
		this.clock_one();
		this.sample[this.sample_index] = this.output();
		this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
		++this.sample_index;
		this.sample_index &= 0x3fff;
	}
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;
};

jsSID.ReSID.prototype.clock_resample_fast = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		for (var i = 0; i < delta_t_sample; i++) {
			this.clock_one();
			this.sample[this.sample_index] = this.output();
			this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
			++this.sample_index;
			this.sample_index &= 0x3fff;
		}
		delta_t -= delta_t_sample;
		this.sample_offset = next_sample_offset & jsSID.ReSID.const.FIXP_MASK;

		var fir_offset = this.sample_offset * this.fir_RES >> jsSID.ReSID.const.FIXP_SHIFT;
		var fir_start = this.fir_offset * this.fir_N;
		var sample_start = this.sample_index - this.fir_N + jsSID.ReSID.const.RINGSIZE;

		var v = 0;
		for (var j = 0; j < this.fir_N; j++) {
			v += this.sample[sample_start + j] * this.fir[fir_start + j];
		}

		v >>= jsSID.ReSID.const.FIR_SHIFT;

		var half = 1 << 15;			// FIXME: const
		if (v >= half) {
			v = half - 1;
		} else if (v < -half) {
			v = -half;
		}
		// new sample output w/ offset
		var final_sample = parseFloat(v) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
	}

	for (var k = 0; k < delta_t; k++) {
		this.clock_one();
		this.sample[this.sample_index] = this.output();
		this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
		++this.sample_index;
		this.sample_index &= 0x3fff;
	}
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;
};


// generate count samples into buffer at offset
jsSID.ReSID.prototype.generateIntoBuffer = function(count, buffer, offset) {
        //console.log("jsSID.ReSID.generateIntoBuffer (count: " + count + ", offset: " + offset + ")");
        // FIXME: this could be done in one pass. (No?)
        for (var i = offset; i < offset + count; i++) {
                buffer[i] = 0;
        }
	var delta = (this.cycles_per_sample * count) >> jsSID.ReSID.const.FIXP_SHIFT;
	var s = this.clock(delta, buffer, count, 1, offset);
        //console.log("jsSID.ReSID.generateIntoBuffer (delta: " + delta + ", samples clocked: " + s + ")");
	return s;
};

jsSID.ReSID.prototype.generate = function(samples) {
        var data = new Array(samples);
        this.generateIntoBuffer(samples, data, 0);
        return data;
};

// add driver profile(s) to registry:
jsSID.synth.resid_fast = {
        desc: "ReSID - Fast",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_FAST }
};
jsSID.synth.resid_interpolate = {
        desc: "ReSID - Interpolate",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE }
};
jsSID.synth.resid_resample_fast = {
        desc: "ReSID - Resample/Fast (Broken)",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST }
};
jsSID.synth.resid_resample_interpolate = {
        desc: "ReSID - Resample/Interpolate",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE }
};



export { jsSID };
