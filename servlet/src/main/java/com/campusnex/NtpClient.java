package com.campusnex;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

/**
 * A small SNTP (RFC 4330) client. It sends one 48-byte request over UDP port
 * 123 and calculates the clock offset using the four standard timestamps:
 *
 *   T1 = client transmit, T2 = server receive, T3 = server transmit, T4 = client receive
 *   offset = ((T2 - T1) + (T3 - T4)) / 2
 *   delay  = (T4 - T1) - (T3 - T2)
 *
 * Browsers cannot open UDP sockets, so this must run on the server side.
 */
public final class NtpClient {
    private static final long NTP_TO_UNIX_SECONDS = 2_208_988_800L;

    public record Result(long offsetMillis, long delayMillis, int stratum, String server) { }

    private NtpClient() { }

    public static Result query(String host, int port, int timeoutMillis) throws IOException {
        byte[] buf = new byte[48];
        buf[0] = 0x1B; // LI = 0, VN = 3, Mode = 3 (client)
        InetAddress address = InetAddress.getByName(host);

        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setSoTimeout(timeoutMillis);
            long t1 = System.currentTimeMillis();
            socket.send(new DatagramPacket(buf, buf.length, address, port));
            DatagramPacket reply = new DatagramPacket(new byte[48], 48);
            socket.receive(reply);
            long t4 = System.currentTimeMillis();

            byte[] b = reply.getData();
            if (reply.getLength() < 48) throw new IOException("Short NTP reply (" + reply.getLength() + " bytes)");
            int mode = b[0] & 0x07;
            int stratum = b[1] & 0xFF;
            if (mode != 4 && mode != 5) throw new IOException("Unexpected NTP mode " + mode);
            if (stratum == 0) throw new IOException("NTP server sent a kiss-of-death packet");

            long t2 = toUnixMillis(b, 32);
            long t3 = toUnixMillis(b, 40);
            long offset = ((t2 - t1) + (t3 - t4)) / 2;
            long delay = (t4 - t1) - (t3 - t2);
            return new Result(offset, delay, stratum, host);
        }
    }

    /** Converts a 64-bit NTP timestamp (seconds since 1900 + fraction) to Unix milliseconds. */
    static long toUnixMillis(byte[] b, int offset) {
        long seconds = u32(b, offset);
        long fraction = u32(b, offset + 4);
        if ((seconds & 0x8000_0000L) == 0) seconds += 0x1_0000_0000L; // NTP era 1 (after 2036)
        return (seconds - NTP_TO_UNIX_SECONDS) * 1000L + ((fraction * 1000L) >>> 32);
    }

    private static long u32(byte[] b, int o) {
        return ((long) (b[o] & 0xFF) << 24) | ((long) (b[o + 1] & 0xFF) << 16)
                | ((long) (b[o + 2] & 0xFF) << 8) | (b[o + 3] & 0xFF);
    }
}
